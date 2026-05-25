#!/bin/sh
set -e

echo "=== mealprep backend starting ==="
echo "PORT=${PORT:-5000}"

if [ -z "$FLASK_SECRET_KEY" ] || [ -z "$JWT_SECRET_KEY" ]; then
  echo "ERROR: FLASK_SECRET_KEY and JWT_SECRET_KEY must be set"
  exit 1
fi

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set — connect Postgres in Railway Variables"
  exit 1
fi

# Railway guard only — local docker-compose uses host name "db"
if [ -n "$RAILWAY_ENVIRONMENT" ] || [ -n "$RAILWAY_PROJECT_ID" ]; then
  case "$DATABASE_URL" in
    *"@db:"*|*"@db/"*)
      echo "ERROR: DATABASE_URL points at Docker host 'db', not Railway Postgres"
      echo "Set DATABASE_URL=\${{Postgres.DATABASE_URL}} on the backend service"
      exit 1
      ;;
  esac
fi

echo "Running database migrations..."
flask db upgrade
echo "Migrations complete. Starting gunicorn..."
exec gunicorn --bind "0.0.0.0:${PORT:-5000}" --workers 2 --timeout 120 "run:app"
