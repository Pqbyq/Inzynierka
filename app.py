from flask import Flask, render_template, request, jsonify, redirect, url_for
from logging.handlers import RotatingFileHandler
import logging
import os
from datetime import datetime
import pytz
from kubernetes import client, config
from kubernetes.client.rest import ApiException
from metrics import get_cluster_metrics
from db import save_to_postgresql, get_unique_namespaces, get_pods_in_namespace, get_latest_metrics, get_usage_over_time
from flask_apscheduler import APScheduler


log_dir = '/var/log/metrics-app/'
log_file = 'app.log'

# Sprawdź, czy katalog logów istnieje
if not os.path.exists(log_dir):
    os.makedirs(log_dir)

# Konfiguracja logowania
app = Flask(__name__)
app.logger.setLevel(logging.DEBUG)
handler = RotatingFileHandler(os.path.join(log_dir, log_file), maxBytes=10000, backupCount=1)
handler.setLevel(logging.DEBUG)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)
app.logger.addHandler(handler)

# Konfiguracja APScheduler
class Config:
    SCHEDULER_API_ENABLED = True

app.config.from_object(Config())
scheduler = APScheduler()
scheduler.init_app(app)

@scheduler.task('interval', id='get_and_save_metrics', minutes=1)
def get_and_save_metrics():
    try:
        app.logger.info("Starting to get cluster metrics")
        metrics = get_cluster_metrics(namespace=None)
        app.logger.info(f"Retrieved metrics: {metrics}")
        app.logger.info("Starting to save metrics to PostgreSQL")
        save_to_postgresql(metrics)
        app.logger.info("Metrics saved successfully")
    except Exception as e:
        app.logger.error(f"Error: {e}")

@app.route('/', methods=['GET'])
def index():
    selected_namespace = request.args.get('namespace', 'All')
    selected_pods = request.args.getlist('pods')
    start_time = request.args.get('start_time')
    end_time = request.args.get('end_time')
    namespaces = get_unique_namespaces()
    pods = get_pods_in_namespace(None if selected_namespace == 'All' else selected_namespace)
    metrics = get_latest_metrics(
        None if selected_namespace == 'All' else selected_namespace,
        selected_pods if selected_pods else None
    )
    app.logger.info(f"Selected namespace: {selected_namespace}")
    app.logger.info(f"Selected pods: {selected_pods}")
    app.logger.info(f"Namespaces: {namespaces}")
    app.logger.info(f"Pods: {pods}")
    app.logger.info(f"Metrics: {metrics}")
    return render_template('index.html', metrics=metrics, namespaces=namespaces, pods=pods,
                           selected_namespace=selected_namespace, selected_pods=selected_pods)

@app.route('/api/pods', methods=['GET'])
def get_pods():
    namespace = request.args.get('namespace')
    pods = get_pods_in_namespace(namespace)
    return jsonify({'pods': pods})

@app.route('/api/usage', methods=['GET'])
def usage():
    namespace = request.args.get('namespace')
    pods = request.args.getlist('pods[]')
    start_time = request.args.get('start_time')
    end_time = request.args.get('end_time')
    app.logger.info(f"Fetching usage for namespace: {namespace}, pods: {pods}, start_time: {start_time}, end_time: {end_time}")
    if not namespace or not pods or not start_time or not end_time:
        return jsonify({'error': 'Missing required parameters'}), 400
    data = get_usage_over_time(namespace, pods, start_time, end_time)
    response = {
        'cpu_datasets': data['cpu_datasets'],
        'memory_datasets': data['memory_datasets'],
        'labels': data['labels']
    }
    return jsonify(response)

@app.route('/pod/<namespace>/<pod_name>', methods=['GET'])
def pod_details(namespace, pod_name):
    pod_metrics = get_latest_metrics(namespace, [pod_name])
    pod_logs = get_pod_logs(namespace, pod_name)
    return render_template('pod_details.html', pod_metrics=pod_metrics, pod_logs=pod_logs, namespace=namespace, pod_name=pod_name)

@app.route('/restart_pod', methods=['POST'])
def restart_pod():
    namespace = request.form.get('namespace')
    pod_name = request.form.get('pod_name')
    if namespace and pod_name:
        restart_pod_function(namespace, pod_name)
        return jsonify({'status': 'success'})
    return jsonify({'status': 'failure', 'message': 'Missing namespace or pod name'}), 400

def get_pod_logs(namespace, pod_name):
    v1 = client.CoreV1Api()
    try:
        logs = v1.read_namespaced_pod_log(name=pod_name, namespace=namespace)
        return logs
    except client.exceptions.ApiException as e:
        return str(e)

def restart_pod_function(namespace, pod_name):
    v1 = client.CoreV1Api()
    try:
        v1.delete_namespaced_pod(name=pod_name, namespace=namespace)
        return True
    except client.exceptions.ApiException as e:
        print(f"Exception when deleting pod: {e}")
        return False


if __name__ == '__main__':
    scheduler.start()
    app.run(debug=True, host='0.0.0.0')
