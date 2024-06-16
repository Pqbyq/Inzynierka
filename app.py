from flask import Flask, render_template, request, jsonify
from logging.handlers import RotatingFileHandler
import logging
import os
from datetime import datetime
import pytz
from metrics import get_cluster_metrics
from db import save_to_postgresql, get_unique_namespaces, get_pods_in_namespace, get_latest_metrics, get_cpu_usage_over_time
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

# Ustawienia lokalnej strefy czasowej
local_timezone = pytz.timezone('Europe/Warsaw')

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
    selected_pod = request.args.get('pod', 'All')
    start_time = request.args.get('start_time')
    end_time = request.args.get('end_time')
    namespaces = get_unique_namespaces()
    pods = get_pods_in_namespace(None if selected_namespace == 'All' else selected_namespace)
    metrics = get_latest_metrics(
        None if selected_namespace == 'All' else selected_namespace,
        None if selected_pod == 'All' else selected_pod
    )
    app.logger.info(f"Selected namespace: {selected_namespace}")
    app.logger.info(f"Selected pod: {selected_pod}")
    app.logger.info(f"Namespaces: {namespaces}")
    app.logger.info(f"Pods: {pods}")
    app.logger.info(f"Metrics: {metrics}")
    return render_template('index.html', metrics=metrics, namespaces=namespaces, pods=pods,
                           selected_namespace=selected_namespace, selected_pod=selected_pod)

@app.route('/api/cpu_usage', methods=['GET'])
def cpu_usage():
    namespace = request.args.get('namespace', None)
    pod = request.args.get('pod', None)
    start_time = request.args.get('start_time', None)
    end_time = request.args.get('end_time', None)

    app.logger.info(f"Fetching CPU usage for namespace: {namespace}, pod: {pod}, start_time: {start_time}, end_time: {end_time}")
    
    data = get_cpu_usage_over_time(namespace, pod, start_time, end_time)
    app.logger.info(f"CPU usage data: {data}")
    return jsonify(data)

if __name__ == '__main__':
    scheduler.start()
    app.run(debug=True, host='0.0.0.0')
