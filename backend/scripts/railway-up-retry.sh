#!/bin/sh
# Retry railway up for transient API errors (e.g. 502 during upload).
# Usage: railway-up-retry.sh [railway up flags...]
set -eu

MAX_ATTEMPTS=3
INTERVAL_SECONDS=20
attempt=1

while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  echo "Attempt ${attempt}/${MAX_ATTEMPTS}: railway up $*"
  output=$(mktemp)
  if railway up "$@" >"$output" 2>&1; then
    cat "$output"
    rm -f "$output"
    exit 0
  fi
  cat "$output" >&2
  if grep -qiE 'invalid project token|invalid or expired|not signed in|unauthorized' "$output"; then
    rm -f "$output"
    echo "ERROR: non-retryable Railway auth/token error" >&2
    exit 1
  fi
  rm -f "$output"
  if [ "$attempt" -eq "$MAX_ATTEMPTS" ]; then
    break
  fi
  echo "railway up failed; retrying in ${INTERVAL_SECONDS}s..."
  sleep "$INTERVAL_SECONDS"
  attempt=$((attempt + 1))
done

echo "ERROR: railway up failed after ${MAX_ATTEMPTS} attempts" >&2
exit 1
