# Authentication compatibility

**Production auth:** FastAPI in `backend/app/api/routes/auth.py`. Canonical behavior: [`docs/SECURITY.md`](../SECURITY.md) and [`API_CONTRACT.md`](./API_CONTRACT.md).

Historical Flask parity analysis from the 2025–2026 migration lives in [`docs/audits/archive/backend-migration-completed/`](../audits/archive/backend-migration-completed/) — do not treat it as current state.

---

## Current FastAPI auth (verified)

| Aspect | Implementation | Source |
|--------|----------------|--------|
| JWT signing | `JWT_SECRET_KEY`, HS256 | `app/core/config.py`, token service |
| Response shape | `{ "token": "<jwt>" }` | `TokenResponse`, auth routes |
| Authorization | `Authorization: Bearer <token>` | `app/api/dependencies/` |
| Password hash | Werkzeug-compatible verify | `app/core/passwords.py` |
| Token storage (frontend) | `localStorage` by default | `frontend-next/lib/auth/storage.ts` |
| Google OAuth | authlib → one-time code → `POST /api/auth/exchange` | `auth.py` |
| Rate limiting | In-memory sliding window | `app/core/rate_limit.py` |
| Refresh tokens | **None** (single JWT) | — |
| Multi-tenant claims | **None** | OnTrack is per-user, not tenant SaaS |

---

## Contract invariants (do not break)

1. Login, register, and OAuth exchange return **`{ "token" }` only** — not `{ access_token, refresh_token }`.
2. Existing password hashes from pre-cutover users must keep verifying (werkzeug schemes).
3. OAuth redirect flow: backend callback → frontend `?code=` → exchange → JWT.
4. `FRONTEND_URL` must list exact browser origins for CORS.
5. 401 responses trigger frontend logout path.

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET_KEY` | JWT signing |
| `FLASK_SECRET_KEY` | OAuth session cookie signing (name kept for Railway parity) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth (optional) |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL |
| `FRONTEND_URL` | CORS allowed origins |
| `AUTH_CODE_TTL_SECONDS` | OAuth code TTL (default 120) |

---

## Tests

```bash
cd backend
uv run pytest tests/contract/test_auth_contract.py -q
```

---

## Related

- [SECURITY.md](../SECURITY.md) — threat model and BFF notes
- [API_CONTRACT.md](./API_CONTRACT.md) — endpoint matrix
- [ADR 0001](../adr/0001-bff-production-mode.md) — BFF production decision
