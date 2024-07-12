from kubernetes import client, config
from kubernetes.client.rest import ApiException
from kubernetes.config import ConfigException
import datetime as d
import os


def convert_to_readable_cpu(value):
    units = {'K': 1e3, 'M': 1e6, 'G': 1e9, 'T': 1e12, 'P': 1e15, 'E': 1e18, 'Z': 1e21, 'Y': 1e24, 'n': 1e-9,
             'Ki': 1024, 'Mi': 1024 ** 2, 'Gi': 1024 ** 3, 'Ti': 1024 ** 4, 'Pi': 1024 ** 5, 'Ei': 1024 ** 6}

    for unit in units:
        if value.endswith(unit):
            numeric_value = float(value[:-len(unit)])
            converted_value = numeric_value * units[unit]
            return round(converted_value, 4)

    return round(float(value), 2)

def convert_to_readable_memory(value):
    units = {'K': 1e3 / 1e6, 'M': 1e6 / 1e6, 'G': 1e9 / 1e6, 'T': 1e12 / 1e6, 'P': 1e15 / 1e6, 'E': 1e18 / 1e6, 'Z': 1e21 / 1e6, 'Y': 1e24 / 1e6, 'n': 1e-9 / 1e6,
             'Ki': 1024 / 1e6, 'Mi': 1024 ** 2 / 1e6, 'Gi': 1024 ** 3 / 1e6, 'Ti': 1024 ** 4 / 1e6, 'Pi': 1024 ** 5 / 1e6, 'Ei': 1024 ** 6 / 1e6}

    for unit in units:
        if value.endswith(unit):
            numeric_value = float(value[:-len(unit)])
            converted_value = numeric_value * units[unit]
            return round(converted_value, 4)

    return round(float(value) / 1e6, 4)


def get_cluster_metrics(namespace=None):
    try:
        config.load_incluster_config()
    except ConfigException:
        config.load_kube_config()
    
    v1 = client.CoreV1Api()

    try:
        pods = v1.list_pod_for_all_namespaces(watch=False)
        metric_server_api = client.CustomObjectsApi()
        pod_metrics_list = metric_server_api.list_cluster_custom_object(
            group="metrics.k8s.io",
            version="v1beta1",
            plural="pods"
        )
    except ApiException as e:
        print(f"Error while fetching metrics: {e}")
        return []

    cluster_metrics = []

    for pod in pods.items:
        if namespace is None or pod.metadata.namespace == namespace:
            pod_name = pod.metadata.name
            pod_status = pod.status.phase

            # Check for container status conditions like CrashLoopBackOff
            for container_status in pod.status.container_statuses:
                if container_status.state.waiting and container_status.state.waiting.reason:
                    pod_status = container_status.state.waiting.reason
                elif container_status.state.terminated and container_status.state.terminated.reason:
                    pod_status = container_status.state.terminated.reason

            # Szukaj metryk dla danego poda
            pod_metrics = next((metrics for metrics in pod_metrics_list['items'] if metrics['metadata']['name'] == pod_name), None)

            if pod_metrics:
                cpu_usage = convert_to_readable_cpu(pod_metrics['containers'][0]['usage']['cpu'])
                memory_usage = convert_to_readable_memory(pod_metrics['containers'][0]['usage']['memory'])
            else:
                cpu_usage = 0.0
                memory_usage = 0.0

            cluster_metrics.append({
                'namespace': pod.metadata.namespace,
                'name': pod_name,
                'status': pod_status,
                'cpu_usage': cpu_usage,
                'memory_usage': memory_usage,
                'timestamp': d.datetime.now().replace(microsecond=0)
            })

    return cluster_metrics
