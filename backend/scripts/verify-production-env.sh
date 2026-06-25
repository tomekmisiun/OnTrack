#!/bin/sh
# Verify production API URL and CORS origin alignment (AUTH-001 / AUTH-002).
# Usage:
#   API_URL=https://<api> FRONTEND_ORIGIN=https://<frontend> ./scripts/verify-production-env.sh
#   STRICT_PRODUCTION=1 ...  # fail if API_URL looks local
set -eu

API_URL="${API_URL:?Set API_URL to the FastAPI base URL (no trailing slash)}"
FRONTEND_ORIGIN="${FRONTEND_ORIGIN:?Set FRONTEND_ORIGIN to the browser origin of ontrackapp}"

fail() {
  echo "FAIL: $1"
  exit 1
}

echo "=== OnTrack production env verify ==="
echo "API_URL=$API_URL"
echo "FRONTEND_ORIGIN=$FRONTEND_ORIGIN"

if [ "${STRICT_PRODUCTION:-0}" = "1" ]; then
  case "$API_URL" in
    *localhost*|*127.0.0.1*)
      fail "API_URL looks local — set NEXT_PUBLIC_API_URL to public ontrack-back URL"
      ;;
  esac
  case "$FRONTEND_ORIGIN" in
    *localhost*|*127.0.0.1*)
      fail "FRONTEND_ORIGIN looks local — use production ontrackapp origin"
      ;;
  esac
fi

echo -n "GET /health... "
health_code=$(curl -s -o /tmp/ontrack-env-health.json -w '%{http_code}' "$API_URL/health")
[ "$health_code" = "200" ] || fail "health expected 200, got $health_code"
grep -q '"status"[[:space:]]*:[[:space:]]*"ok"' /tmp/ontrack-env-health.json \
  || fail "health body missing status ok"
echo "OK"

echo -n "CORS preflight /api/auth/login... "
headers=$(curl -s -D - -o /dev/null -X OPTIONS "$API_URL/api/auth/login" \
  -H "Origin: $FRONTEND_ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type")

echo "$headers" | grep -qi "access-control-allow-origin: $FRONTEND_ORIGIN" \
  || fail "missing Access-Control-Allow-Origin: $FRONTEND_ORIGIN"
echo "$headers" | grep -qi "access-control-allow-credentials: true" \
  || fail "missing Access-Control-Allow-Credentials: true"
echo "OK"

rm -f /tmp/ontrack-env-health.json
echo "=== Env verify passed ==="
echo "Reminder: ontrackapp NEXT_PUBLIC_API_URL must equal API_URL at build time."
