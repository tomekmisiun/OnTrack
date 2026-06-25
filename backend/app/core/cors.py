"""CORS origin resolution for FastAPI."""

from urllib.parse import urlparse, urlunparse


def _peer_loopback_origin(origin: str) -> str | None:
    """Return localhost <-> 127.0.0.1 peer for the same port, if applicable."""
    parsed = urlparse(origin)
    host = parsed.hostname
    if not host or not parsed.scheme:
        return None
    if host == "localhost":
        peer_host = "127.0.0.1"
    elif host == "127.0.0.1":
        peer_host = "localhost"
    else:
        return None
    port = parsed.port
    netloc = f"{peer_host}:{port}" if port else peer_host
    return urlunparse((parsed.scheme, netloc, parsed.path or "", "", "", ""))


def cors_allowed_origins(
    frontend_url: str,
    *,
    debug: bool = False,
    testing: bool = False,
) -> list[str]:
    """
    Parse FRONTEND_URL (comma-separated) into CORS allow_origins.

    In debug/testing, also allow the loopback peer (localhost vs 127.0.0.1) for
    each configured origin so local Next.js and Playwright work without widening
    production CORS.
    """
    origins = [o.strip() for o in frontend_url.split(",") if o.strip()]
    if not origins:
        origins = ["http://localhost:3000"]

    if not (debug or testing):
        return origins

    expanded: set[str] = set(origins)
    for origin in list(origins):
        peer = _peer_loopback_origin(origin)
        if peer:
            expanded.add(peer)
    return sorted(expanded)
