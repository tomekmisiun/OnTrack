#!/bin/sh
set -e

echo "=== OnTrack FastAPI backend starting ==="
echo "PORT=${PORT:-8000}"

if [ -z "$FLASK_SECRET_KEY" ] || [ -z "$JWT_SECRET_KEY" ]; then
  echo "ERROR: FLASK_SECRET_KEY and JWT_SECRET_KEY must be set"
  exit 1
fi

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set — attach Postgres in Railway Variables"
  exit 1
fi

if [ -n "$RAILWAY_ENVIRONMENT" ] || [ -n "$RAILWAY_PROJECT_ID" ]; then
  case "$DATABASE_URL" in
    *"@db:"*|*"@db/"*)
      echo "ERROR: DATABASE_URL points at Docker host 'db', not Railway Postgres"
      echo "Set DATABASE_URL=\${{Postgres.DATABASE_URL}} on the FastAPI service"
      exit 1
      ;;
  esac
fi

if [ -n "$RAILWAY_ENVIRONMENT" ] || [ -n "$RAILWAY_PROJECT_ID" ]; then
  echo "Starting uvicorn (Railway proxy headers enabled)..."
  exec uv run uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --proxy-headers \
    --forwarded-allow-ips='*'
fi

echo "Starting uvicorn..."
exec uv run uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
