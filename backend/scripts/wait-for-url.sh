#!/bin/sh
# Poll an HTTP URL until it returns HTTP 200 or attempts are exhausted.
# Usage: wait-for-url.sh <url> [max_attempts] [interval_seconds]
set -eu

URL="${1:?Usage: wait-for-url.sh <url> [max_attempts] [interval_seconds]}"
MAX_ATTEMPTS="${2:-30}"
INTERVAL="${3:-10}"

attempt=1
while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  echo "Attempt ${attempt}/${MAX_ATTEMPTS}: GET ${URL}"
  code=$(curl -sL --max-redirs 5 -o /dev/null -w '%{http_code}' "$URL" || true)
  if [ "$code" = "200" ]; then
    echo "Ready: ${URL} (HTTP 200)"
    exit 0
  fi
  echo "Not ready (HTTP ${code:-000}); waiting ${INTERVAL}s..."
  sleep "$INTERVAL"
  attempt=$((attempt + 1))
done

echo "ERROR: ${URL} did not become ready after ${MAX_ATTEMPTS} attempts" >&2
exit 1
