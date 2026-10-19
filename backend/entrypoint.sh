#!/bin/sh
set -e

echo "Aguardando banco de dados..."

python - <<'PY'
import os
import socket
import time

host = os.getenv("POSTGRES_HOST", "db")
port = int(os.getenv("POSTGRES_PORT", "5432"))

for attempt in range(30):
    try:
        with socket.create_connection((host, port), timeout=2):
            print("Banco de dados disponível.")
            break
    except OSError:
        print(f"Tentativa {attempt + 1}/30...")
        time.sleep(2)
else:
    raise SystemExit("Não foi possível conectar ao PostgreSQL.")
PY

echo "Aplicando migrations..."
python manage.py migrate --noinput

echo "Iniciando Django..."
exec python manage.py runserver 0.0.0.0:8000
