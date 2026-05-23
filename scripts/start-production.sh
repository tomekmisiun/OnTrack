#!/bin/sh
set -e
flask db upgrade
exec gunicorn --bind "0.0.0.0:${PORT:-5000}" --workers 2 --timeout 120 "run:app"
