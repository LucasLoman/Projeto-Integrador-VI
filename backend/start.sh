#!/usr/bin/env bash
set -e

echo "Aplicando migrações no PostgreSQL..."
python manage.py migrate --noinput

echo "Iniciando AutoStock API..."
exec gunicorn autostock.wsgi:application \
  --bind "0.0.0.0:${PORT:-10000}" \
  --workers 1 \
  --timeout 120
