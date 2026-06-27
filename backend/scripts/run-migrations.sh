#!/bin/sh
# Pre-deploy migrations (Railway preDeployCommand).
set -eu

echo "=== OnTrack Alembic migrations ==="

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set"
  exit 1
fi

uv run python scripts/ensure_alembic_head.py

echo "=== OnTrack global catalog import ==="
uv run python -m app.scripts.import_catalog

echo "=== OnTrack restore catalog user references ==="
uv run python -m app.scripts.restore_post_catalog_migration
