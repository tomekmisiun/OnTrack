#!/bin/sh
set -e

echo "=== OnTrack Alembic migrations ==="

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set"
  exit 1
fi

uv run alembic upgrade head
echo "Alembic current:"
uv run alembic current
