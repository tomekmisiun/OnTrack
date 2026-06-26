"""In-memory sliding-window rate limiting for auth endpoints."""

from __future__ import annotations

import time
from collections import defaultdict
from threading import Lock

from fastapi import HTTPException, Request

_BUCKETS: dict[str, list[float]] = defaultdict(list)
_LOCK = Lock()


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def check_rate_limit(
    request: Request,
    *,
    scope: str,
    max_requests: int,
    window_seconds: int,
) -> None:
    """Raise HTTP 429 when the client exceeds the limit for this scope."""
    key = f"{scope}:{_client_ip(request)}"
    now = time.monotonic()
    cutoff = now - window_seconds

    with _LOCK:
        bucket = _BUCKETS[key]
        while bucket and bucket[0] < cutoff:
            bucket.pop(0)
        if len(bucket) >= max_requests:
            raise HTTPException(status_code=429, detail={"error": "Too many requests"})
        bucket.append(now)


def reset_rate_limits() -> None:
    """Clear buckets — for tests only."""
    with _LOCK:
        _BUCKETS.clear()
