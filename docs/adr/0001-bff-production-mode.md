# ADR 0001: Production BFF mode

**Status:** Accepted  
**Date:** 2026-06-26  
**Context:** Next.js BFF route handlers and HttpOnly session cookies are implemented but disabled in production.

## Decision drivers

- Default auth stores JWT in `localStorage` (tasks 1–15 behavior).
- BFF mode (`NEXT_PUBLIC_BFF_ENABLED=1`) moves tokens to HttpOnly cookies and proxies API calls through Next.js.
- Production Railway config does not set the BFF flag; middleware only checks a session hint cookie for route gating.

## Options considered

| Option | Description |
|--------|-------------|
| **A. Keep BFF off (default)** | Continue Bearer JWT from browser to FastAPI. Document XSS risk and middleware hint-only behavior. |
| **B. Enable BFF in production** | Set `NEXT_PUBLIC_BFF_ENABLED=1` on `ontrackapp`; requires auth contract tests + staging/production HTTP smoke on Railway. |
| **C. Remove BFF code** | Simplify codebase; lose HttpOnly path for future hardening. |
| **D. Hybrid** | BFF for auth routes only; direct API for data routes. Higher complexity. |

## Decision

**Option A — keep BFF off in production** until a dedicated hardening milestone validates cookie mode end-to-end on Railway.

## Consequences

- **Positive:** No production behavior change; auth contract tests and deploy HTTP smoke remain valid.
- **Positive:** BFF code stays available for local experiments and future opt-in.
- **Negative:** JWT remains in `localStorage`; XSS could exfiltrate tokens (mitigate via CSP and input hygiene).
- **Negative:** Next.js middleware cannot cryptographically verify JWT — it only checks cookie presence for UX redirects.

## References

- `frontend-next/lib/bff/config.ts`
- [`security/overview.md`](../security/overview.md) — auth and BFF notes
- [`project/current-state.md`](../project/current-state.md)
