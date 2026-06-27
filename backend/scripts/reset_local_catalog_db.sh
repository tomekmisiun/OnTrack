#!/usr/bin/env bash
# Reset local developer catalog DB and re-seed from canonical JSON.
# NEVER run against Railway/production DATABASE_URL.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/backend"

if [[ "${DATABASE_URL:-}" == *railway* ]] || [[ "${DATABASE_URL:-}" == *prod* ]]; then
  echo "Refusing to reset: DATABASE_URL looks like a remote/production database." >&2
  exit 1
fi

echo "Applying Alembic migrations..."
python -m alembic upgrade head

echo "Importing canonical catalog..."
python -m app.scripts.import_catalog

echo "Done. System catalog rebuilt from backend/data/canonical/*.json"
