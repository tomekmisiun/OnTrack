# Security

**Last updated:** 2026-06-27

Operational security notes for OnTrack. Not a formal threat model.

---

## Authentication

| Topic | Implementation |
|-------|----------------|
| Password hashing | bcrypt via passlib |
| Session token | JWT signed with `JWT_SECRET_KEY` |
| OAuth session | Signed cookie via `FLASK_SECRET_KEY` during Google flow |
| Auth response shape | `{ "token": "…" }` — see [api-contract.md](../specs/api-contract.md) |

### Token storage (frontend)

- **Default:** JWT in `localStorage`, sent as `Authorization: Bearer`
- **Optional BFF:** When `NEXT_PUBLIC_BFF_ENABLED=1`, Next.js route handlers store token in HttpOnly cookie

Production Railway config does **not** set BFF mode. Decision: [ADR 0001](../adr/0001-bff-production-mode.md)

### BFF threat model (condensed)

**Default (BFF off)**

| Asset | Storage | XSS | CSRF |
|-------|---------|-----|------|
| JWT | `localStorage` | **High** — script can exfiltrate token | Low — Bearer header |
| Session hint | `ontrack_has_token` cookie (non-HttpOnly) | Low — flag only | Low — middleware redirect only |

**BFF on (`NEXT_PUBLIC_BFF_ENABLED=1`)**

| Asset | Storage | XSS | CSRF |
|-------|---------|-----|------|
| JWT | `ontrack_session` HttpOnly cookie | **Reduced** — JS cannot read token | **Medium** — mitigated by `SameSite=Lax` |
| API abuse from XSS | Same-origin fetch with cookies | Attacker can act as user but not steal token cross-origin | — |

Route handlers: `app/api/bff/[...path]/route.ts`, `app/api/auth/session/route.ts` — proxy only, no domain logic. See `lib/bff/proxy.ts`.

Historical full write-up: [FRONTEND_NEXT_BFF.md](../archive/audits/FRONTEND_NEXT_BFF.md) (archived).

---

## Authorization

- User-scoped resources filtered by authenticated user ID in services/repositories
- Public endpoints limited to `public_router` (e.g. dish compare)
- Household members scoped to owning user account

Review route dependencies when adding new endpoints.

---

## Secrets management

| Rule | Detail |
|------|--------|
| Never commit | `.env`, tokens, Railway credentials |
| GitHub | `RAILWAY_TOKEN` in Actions secrets only |
| Local | Copy from `.env.example`; use strong random keys |
| Production | Set in Railway Variables dashboard |

Rotate `JWT_SECRET_KEY` and `FLASK_SECRET_KEY` if exposure suspected — invalidates existing sessions.

---

## CORS

Backend reads `FRONTEND_URL` (comma-separated origins). Must match the browser origin of `ontrackapp` **exactly** (scheme, host, no trailing slash).

Misconfiguration causes register/login failures from the browser despite healthy API.

---

## Password reset

- API generates time-limited reset token (1 hour)
- When `SMTP_HOST` and `SMTP_FROM` are configured, backend emails a reset link to the user's registered email
- `reset_token` in JSON response remains limited to `DEBUG` / `TESTING` only

---

## External APIs

Optional keys (`GEMINI_API_KEY`, `PEXELS_API_KEY`, `DEEPSEEK_API_KEY`, Google OAuth) — store as env vars only. Features skip gracefully when unset.

---

## Dependencies

- Python: `uv.lock` in `backend/`
- Node: `package-lock.json` in `frontend-next/`
- CI runs `ruff`, ESLint, typecheck — not full dependency audit

Run `npm audit` / review Dependabot alerts as part of release hygiene.

---

## Docker and production images

- Backend production image: `backend/Dockerfile` (non-root where configured)
- Frontend production: `frontend-next/Dockerfile.railway` multi-stage build
- Do not run Compose dev targets in production

---

## Monitoring and logging

- `/metrics` exposes Prometheus metrics — restrict network access in production (Railway private networking / firewall)
- Do not log JWTs, passwords, or reset tokens
- `verify-production-auth.sh` explicitly avoids printing tokens

---

## Error tracking (optional)

When configured, unhandled API and frontend errors are sent to [Sentry](https://sentry.io).

| Service | Variable | Notes |
|---------|----------|-------|
| Backend | `SENTRY_DSN` | Server-side exceptions via `sentry-sdk` |
| Backend | `SENTRY_ENVIRONMENT` | e.g. `production`, `staging` |
| Backend | `SENTRY_TRACES_SAMPLE_RATE` | Default `0` (errors only) |
| Frontend | `NEXT_PUBLIC_SENTRY_DSN` | Build-time; browser errors |
| Frontend | `SENTRY_ENVIRONMENT` | Runtime on Node during SSR |

When DSN variables are unset, Sentry code paths are no-ops — no outbound calls.

Do not commit DSN values. Use Railway variables per environment.

---

## Reporting vulnerabilities

Use GitHub private security advisories for this repository or contact maintainers directly. Do not open public issues with exploit details.

---

## Related documents

- [architecture/overview.md](../architecture/overview.md) — auth flow diagram
- [operations/deployment.md](../operations/deployment.md) — production verification
- [ADR 0001 — BFF auth](../adr/0001-bff-production-mode.md)
- `.ai-rules/security.md` — agent binding rules
