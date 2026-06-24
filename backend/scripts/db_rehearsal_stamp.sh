#!/bin/sh
# Stamp FastAPI Alembic head on an existing Flask-migrated database (staging clone).
# Run from backend/ with DATABASE_URL pointing at the clone — never live production first.
set -e

HEAD="7966d120d748"

echo "=== OnTrack DB rehearsal: alembic stamp ==="

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is required"
  exit 1
fi

echo "Pre-stamp schema validation..."
if uv run python scripts/validate_schema.py; then
  echo "Schema already matches models."
else
  echo "Schema drift before stamp — review DATABASE_COMPATIBILITY.md before continuing."
  exit 1
fi

echo "Stamping alembic_version -> $HEAD (no DDL, purge legacy Flask revision id)..."
uv run alembic stamp --purge "$HEAD"

echo "Post-stamp validation..."
uv run alembic current
uv run python scripts/validate_schema.py

echo "Verifying alembic upgrade head is a no-op..."
uv run alembic upgrade head
uv run alembic current

echo "=== Stamp rehearsal complete ==="
