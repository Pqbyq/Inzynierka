from flask import Flask, render_template, request
from logging.handlers import RotatingFileHandler
import logging
import os
from metrics import get_cluster_metrics
from db import save_to_postgresql, get_unique_namespaces, get_latest_metrics
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
    namespaces = get_unique_namespaces()
    metrics = get_latest_metrics(None if selected_namespace == 'All' else selected_namespace)
    app.logger.info(f"Selected namespace: {selected_namespace}")
    app.logger.info(f"Namespaces: {namespaces}")
    app.logger.info(f"Metrics: {metrics}")
    return render_template('index.html', metrics=metrics, namespaces=namespaces,
                           selected_namespace=selected_namespace)

if __name__ == '__main__':
    scheduler.start()
    app.run(debug=True, host='0.0.0.0')
