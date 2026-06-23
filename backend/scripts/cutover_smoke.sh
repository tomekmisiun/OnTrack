#!/bin/sh
# Post-cutover smoke checks against a running FastAPI backend (MIG-016).
# Usage: API_URL=https://your-fastapi.up.railway.app ./scripts/cutover_smoke.sh
set -e

API_URL="${API_URL:?Set API_URL to the FastAPI base URL (no trailing slash)}"

echo "=== OnTrack cutover smoke: $API_URL ==="

check() {
  name="$1"
  shift
  echo -n "$name... "
  if "$@"; then
    echo "OK"
  else
    echo "FAIL"
    exit 1
  fi
}

check "GET /health" curl -sf "$API_URL/health" | grep -q '"status"[[:space:]]*:[[:space:]]*"ok"'

check "GET /api/public/dish-compare?lang=pl" \
  curl -sf "$API_URL/api/public/dish-compare?lang=pl" | grep -q '"dishes"'

check "GET /api/products/ unauthorized → 401" \
  sh -c "test \$(curl -s -o /dev/null -w '%{http_code}' '$API_URL/api/products/') = 401"

echo "=== Smoke passed (auth CRUD requires manual token — see PRODUCTION_CUTOVER.md) ==="
