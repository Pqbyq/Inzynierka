import os
import psycopg2
from psycopg2.extras import RealDictCursor
import logging
import pytz
from datetime import datetime, timezone

# Konfiguracja logowania
log_dir = '/var/log/metrics-app/'
log_file = 'db.log'

if not os.path.exists(log_dir):
    os.makedirs(log_dir)

logger = logging.getLogger('db_logger')
logger.setLevel(logging.DEBUG)
handler = logging.FileHandler(os.path.join(log_dir, log_file))
handler.setLevel(logging.DEBUG)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)
logger.addHandler(handler)

def get_db_connection():
    try:
        conn = psycopg2.connect(
            dbname='mydatabase',
            user='myuser',
            password='mypassword',
            host='postgres',
            port='5432'
        )
        conn.autocommit = True
        return conn
    except Exception as e:
        logger.error(f"Error: {e}")
        return None
    

def save_to_postgresql(metrics):
    try:
        conn = get_db_connection()
        if conn is None:
            logger.error("Failed to connect to the database.")
            return

        cursor = conn.cursor()
        logger.info("Connected to PostgreSQL")

        create_table_query = '''
        CREATE TABLE IF NOT EXISTS Metrics (
            namespace VARCHAR(255),
            name VARCHAR(255),
            status VARCHAR(255),
            cpu_usage VARCHAR(255),
            memory_usage VARCHAR(255),
            timestamp TIMESTAMP
        );
        '''
        cursor.execute(create_table_query)
        conn.commit()
        logger.info("Ensured metrics table exists")

        for metric in metrics:
            namespace = metric.get('namespace', 'unknown')
            name = metric.get('name', 'unknown')
            status = metric.get('status', 'unknown')
            cpu_usage = metric.get('cpu_usage', 'unknown')
            memory_usage = metric.get('memory_usage', 'unknown')
            timestamp = metric.get('timestamp', 'unknown').astimezone(pytz.timezone('Europe/Warsaw'))
            insert_query = '''
            INSERT INTO Metrics (namespace, name, status, cpu_usage, memory_usage, timestamp)
            VALUES (%s, %s, %s, %s, %s, %s);
            '''
            cursor.execute(insert_query, (namespace, name, status, cpu_usage, memory_usage, timestamp))
            conn.commit()
            logger.info(f"Inserted metric: {namespace}, {name}, {status}, {cpu_usage}, {memory_usage}, {timestamp}")

        cursor.close()
        conn.close()
        logger.info("Closed connection to PostgreSQL")
    except Exception as e:
        logger.error(f"Error: {e}")


def get_unique_namespaces():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT DISTINCT namespace FROM metrics;')
    namespaces = [row[0] for row in cursor.fetchall()]
    cursor.close()
    conn.close()
    return namespaces

def get_latest_metrics(namespace=None, pod=None):
    conn = get_db_connection()
    if conn is None:
        print("Failed to connect to the database.")
        return []
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    query = '''
        SELECT DISTINCT ON (name) *
        FROM metrics
    '''
    conditions = []
    params = []

    if namespace:
        conditions.append('namespace = %s')
        params.append(namespace)
    if pod:
        conditions.append('name = %s')
        params.append(pod)
    
    if conditions:
        query += ' WHERE ' + ' AND '.join(conditions)
    
    query += ' ORDER BY name, timestamp DESC'

    cursor.execute(query, params)
    metrics = cursor.fetchall()
    cursor.close()
    conn.close()
    return metrics


def get_pods_in_namespace(namespace):
    if not namespace:
        return []
    conn = get_db_connection()
    if conn is None:
        print("Failed to connect to the database.")
        return []
    cursor = conn.cursor()
    cursor.execute('SELECT DISTINCT name FROM metrics WHERE namespace = %s;', (namespace,))
    pods = [row[0] for row in cursor.fetchall()]
    cursor.close()
    conn.close()
    return pods

def get_cpu_usage_over_time(namespace=None, pod=None, start_time=None, end_time=None):
    conn = get_db_connection()
    if conn is None:
        print("Failed to connect to the database.")
        return {'labels': [], 'datasets': []}

    cursor = conn.cursor(cursor_factory=RealDictCursor)
    query = '''
        SELECT timestamp, name, cpu_usage, namespace
        FROM metrics
        WHERE 1=1
    '''
    params = []
 
    if namespace:
        query += ' AND namespace = %s'
        params.append(namespace)
    if pod:
        query += ' AND name = %s'
        params.append(pod)
    if start_time:
        query += ' AND timestamp >= %s'
        params.append(datetime.fromisoformat(start_time).astimezone(pytz.timezone('Europe/Warsaw')))
    if end_time:
        query += ' AND timestamp <= %s'
        params.append(datetime.fromisoformat(end_time).astimezone(pytz.timezone('Europe/Warsaw')))

    query += ' ORDER BY timestamp'

    cursor.execute(query, params)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    data = {'labels': [], 'datasets': []}
    if rows:
        data['labels'] = sorted(list(set(row['timestamp'].astimezone(pytz.timezone('Europe/Warsaw')).isoformat() for row in rows)))

        containers = {row['name'] for row in rows}
        for container in containers:
            dataset = {
                'label': container,
                'data': [{'x': row['timestamp'].astimezone(pytz.timezone('Europe/Warsaw')).isoformat(), 'y': float(row['cpu_usage']), 'name': row['name'], 'namespace': row['namespace']} for row in rows if row['name'] == container],
                'fill': False
            }
            data['datasets'].append(dataset)
    return data
