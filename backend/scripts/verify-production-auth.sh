#!/bin/sh
# Auth smoke via HTTP (staging or production — no browser).
# Usage:
#   API_URL=https://<api-domain> ./scripts/verify-production-auth.sh
#   API_URL=... FRONTEND_ORIGIN=https://<frontend-domain> ./scripts/verify-production-auth.sh
# Optional: SMOKE_TARGET=staging|production (log label only)
set -eu

API_URL="${API_URL:?Set API_URL to the FastAPI base URL (no trailing slash)}"
FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-http://localhost:3000}"
SMOKE_TARGET="${SMOKE_TARGET:-deployed environment}"

EMAIL="verify_$(date +%s)_$$@example.com"
PASS="VerifyPass123!"

echo "=== OnTrack auth verify (${SMOKE_TARGET}): ${API_URL} ==="
echo "Origin header: $FRONTEND_ORIGIN"
echo "Test user: $EMAIL"

fail() {
  echo "FAIL: $1"
  exit 1
}

check_status() {
  label="$1"
  expected="$2"
  actual="$3"
  if [ "$actual" != "$expected" ]; then
    fail "$label expected HTTP $expected, got $actual"
  fi
  echo "OK  $label (HTTP $actual)"
}

echo -n "GET /health... "
health_code=$(curl -sL --max-redirs 5 -o /tmp/ontrack-verify-health.json -w '%{http_code}' "$API_URL/health")
check_status "GET /health" "200" "$health_code"
grep -q '"status"[[:space:]]*:[[:space:]]*"ok"' /tmp/ontrack-verify-health.json \
  || fail "health body missing status ok"

register_body=$(mktemp)
register_code=$(curl -sL --max-redirs 5 -o "$register_body" -w '%{http_code}' \
  -X POST "$API_URL/api/auth/register" \
  -H 'Content-Type: application/json' \
  -H "Origin: $FRONTEND_ORIGIN" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"lang\":\"pl\"}")
check_status "POST /api/auth/register" "201" "$register_code"
grep -q '"token"' "$register_body" || fail "register response missing token"
TOKEN=$(sed -n 's/.*"token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$register_body" | head -1)
[ -n "$TOKEN" ] || fail "could not parse token from register response"

me_body=$(mktemp)
me_code=$(curl -sL --max-redirs 5 -o "$me_body" -w '%{http_code}' \
  -H "Authorization: Bearer $TOKEN" \
  -H "Origin: $FRONTEND_ORIGIN" \
  "$API_URL/api/auth/me")
check_status "GET /api/auth/me (after register)" "200" "$me_code"
grep -q '"ui_locale"' "$me_body" || fail "/me body missing ui_locale"

login_body=$(mktemp)
login_code=$(curl -sL --max-redirs 5 -o "$login_body" -w '%{http_code}' \
  -X POST "$API_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -H "Origin: $FRONTEND_ORIGIN" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
check_status "POST /api/auth/login" "200" "$login_code"
grep -q '"token"' "$login_body" || fail "login response missing token"

rm -f "$register_body" "$me_body" "$login_body" /tmp/ontrack-verify-health.json

echo "=== Auth verify passed ==="
echo "Registered and authenticated user: $EMAIL"
