# Frontend BFF and HttpOnly session cookies (Task 16)

Optional **Backend-for-Frontend (BFF)** layer in `frontend-next/`. Disabled by default; enable with `NEXT_PUBLIC_BFF_ENABLED=1`.

FastAPI remains the sole domain and auth authority. Route Handlers only **proxy** HTTP and **manage session cookies** — no business rules, validation, or PostgreSQL access in Next.js.

---

## Threat model

### Current default (BFF off)

| Asset | Storage | XSS impact | CSRF impact |
|-------|---------|------------|-------------|
| JWT access token | `localStorage` | **High** — any injected script can read and exfiltrate the token | Low — token sent in `Authorization` header, not cookies |
| Session hint | `ontrack_has_token` (non-HttpOnly cookie) | Low — boolean flag only, no secret | Low — used only for middleware redirect, not API auth |

**Primary risk:** XSS on the Next.js origin allows theft of the JWT from `localStorage` and full account takeover until the token expires.

**Mitigations today:** React escaping, CSP (deployment responsibility), short-lived tokens (backend JWT TTL), HTTPS in production.

### BFF enabled (opt-in)

| Asset | Storage | XSS impact | CSRF impact |
|-------|---------|------------|-------------|
| JWT access token | `ontrack_session` HttpOnly cookie | **Reduced** — JavaScript cannot read the token | **Medium** — cookie sent on same-origin requests; mitigated by `SameSite=Lax` |
| Session hint | Same HttpOnly cookie (presence check in middleware) | Reduced | Same as above |

**Primary risk shift:** CSRF against same-origin `/api/bff/*` and `/api/auth/session` if an attacker tricks a logged-in browser into submitting a request. `SameSite=Lax` blocks cross-site POST in modern browsers for top-level navigations; state-changing API calls from third-party sites are largely blocked.

**Residual XSS impact:** Attacker can still invoke same-origin APIs **as the victim** (browser attaches cookies automatically). HttpOnly prevents **token exfiltration** to another origin, but not abuse of an active session from the compromised page.

**Not in scope (future backend epic):** rotating refresh tokens, server-side session revocation, `Secure` + `__Host-` cookie prefix hardening, CSRF double-submit tokens for defense in depth.

---

## Architecture

```text
Browser (no JWT in JS when BFF on)
    │
    ├─ POST /api/auth/session     ──► FastAPI /api/auth/{login|register|exchange}
    │       sets HttpOnly ontrack_session
    │
    ├─ GET  /api/auth/session     ──► FastAPI /api/auth/me  (Bearer from cookie)
    ├─ DELETE /api/auth/session   ──► clears cookie
    │
    └─ /api/bff/*                 ──► FastAPI /api/*  (thin proxy, Bearer from cookie)
              members, products, recipes, …
```

### Route Handlers (thin proxy only)

| Route | Role |
|-------|------|
| `app/api/bff/[...path]/route.ts` | Forward GET/POST/PATCH/PUT/DELETE to `{NEXT_PUBLIC_API_URL}/api/{path}` with `Authorization: Bearer <cookie>` |
| `app/api/auth/session/route.ts` | Login, register, OAuth code exchange, `/me`, logout — set or clear HttpOnly cookie |

Implementation: `lib/bff/proxy.ts` (URL building, header allowlist, path sanitization). **No duplicate domain logic.**

### Google OAuth

OAuth redirect still targets FastAPI (`/api/auth/google`). Callback returns `?code=` to the frontend; exchange goes through `POST /api/auth/session` so the token never enters `localStorage`.

---

## Configuration

| Variable | Scope | Default | Description |
|----------|-------|---------|-------------|
| `NEXT_PUBLIC_BFF_ENABLED` | build + runtime | unset / `0` | Set to `1` to enable BFF mode |
| `NEXT_PUBLIC_API_URL` | build + server | required in prod | Upstream FastAPI URL for Route Handlers |

When BFF is off, behavior is unchanged from tasks 1–15 (JWT in `localStorage`, `ontrack_has_token` for middleware).

---

## Rollout

1. Deploy with BFF **off** (default) — no user impact.
2. Staging: set `NEXT_PUBLIC_BFF_ENABLED=1`, verify login, OAuth exchange, CRUD smoke tests.
3. Production cutover: enable flag on Railway frontend service, redeploy.
4. Optional follow-up (separate backend epic): native HttpOnly session cookies from FastAPI, refresh tokens, CSRF tokens — would allow dropping the Next.js proxy for auth.

---

## Verification

```bash
cd frontend-next
NEXT_PUBLIC_BFF_ENABLED=1 npm run dev
# Login, navigate modules, logout
npm run test
npm run lint && npm run typecheck && npm run build
```

---

## References

- Migration plan: `docs/FRONTEND_NEXT_MIGRATION_PLAN.md` (Task 16)
- Auth client: `frontend-next/lib/api/auth.ts`
- Proxy helpers: `frontend-next/lib/bff/proxy.ts`
