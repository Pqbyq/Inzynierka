import os
import psycopg2
import logging
from datetime import datetime

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

def save_to_postgresql(metrics):
    try:
        conn = psycopg2.connect(
            dbname='mydatabase',
            user='myuser',
            password='mypassword',
            host='postgres',
            port='5432'
        )
        conn.autocommit = True
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
            timestamp = metric.get('timestamp','unknown')
            insert_query = '''
            INSERT INTO Metrics (namespace, name, status, cpu_usage, memory_usage, timestamp)
            VALUES (%s, %s, %s, %s, %s, %s);
            '''
            cursor.execute(insert_query, (namespace, name, status, cpu_usage, memory_usage,timestamp))
            conn.commit()
            logger.info(f"Inserted metric: {namespace}, {name}, {status}, {cpu_usage}, {memory_usage},{timestamp}")

        cursor.close()
        conn.close()
        logger.info("Closed connection to PostgreSQL")
    except Exception as e:
        logger.error(f"Error: {e}")
