#!/bin/sh
set -e

echo "=== OnTrack FastAPI worker starting ==="

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set"
  exit 1
fi

if [ -z "$REDIS_URL" ]; then
  echo "ERROR: REDIS_URL is not set — attach Redis in Railway Variables"
  exit 1
fi

if [ -n "$RAILWAY_ENVIRONMENT" ] || [ -n "$RAILWAY_PROJECT_ID" ]; then
  case "$DATABASE_URL" in
    *"@db:"*|*"@db/"*)
      echo "ERROR: DATABASE_URL points at Docker host 'db', not Railway Postgres"
      exit 1
      ;;
  esac
fi

exec uv run python -m app.worker.run
