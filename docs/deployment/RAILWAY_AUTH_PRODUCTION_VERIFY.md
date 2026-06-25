# Railway production auth verification

Manual runbook after merging auth recovery (#85) and DishCompare fallback (#86).
No application code changes are required unless a step fails.

**Live status:** operator must confirm in Railway Dashboard. CLI is optional (`railway link`).

---

## 1. Railway service settings (Dashboard)

### `ontrack-back` (API)

| Setting | Required value |
|---------|----------------|
| Root Directory | `backend` |
| Config file path | `/backend/railway.toml` |
| Branch | `main` |
| Wait for CI | ON |

Variables (minimum):

| Variable | Note |
|----------|------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `JWT_SECRET_KEY` | set |
| `FLASK_SECRET_KEY` | set |
| `FRONTEND_URL` | exact browser origin of `ontrackapp` (scheme + host, no trailing slash) |

### `ontrackapp` (frontend)

| Setting | Required value |
|---------|----------------|
| Root Directory | `frontend-next` |
| Config file path | `/frontend-next/railway.toml` |
| `NEXT_PUBLIC_API_URL` | public `ontrack-back` URL (build-time) |

---

## 2. Trigger deploy

1. Merge to `main` → wait for GitHub Actions green.
2. Railway deploys `ontrack-back` then `ontrackapp` (Wait for CI).
3. Open **Deployments** → latest `ontrack-back` deploy.

### Pre-deploy migrations

In deploy logs, open the **Pre-deploy** phase. Expect:

```text
=== OnTrack Alembic migrations ===
...
f1a2b3c4d5e6 (head)
```

If pre-deploy fails, the deployment must **not** go live. Fix `DATABASE_URL` or migration errors before retrying.

---

## 3. API smoke (terminal)

From repo root:

```bash
export API_URL=https://<ontrack-back-domain>
export FRONTEND_ORIGIN=https://<ontrackapp-domain>

chmod +x backend/scripts/cutover_smoke.sh backend/scripts/verify-production-auth.sh backend/scripts/verify-production-env.sh

API_URL="$API_URL" ./backend/scripts/cutover_smoke.sh
API_URL="$API_URL" FRONTEND_ORIGIN="$FRONTEND_ORIGIN" ./backend/scripts/verify-production-auth.sh
API_URL="$API_URL" FRONTEND_ORIGIN="$FRONTEND_ORIGIN" ./backend/scripts/verify-production-env.sh
```

`verify-production-auth.sh` creates a unique user, registers (201), calls `/me`, logs in (200). It does not print JWTs.

---

## 4. Browser smoke (manual)

On `https://<ontrackapp-domain>`:

1. Open `/login` — DishCompare widget visible.
2. Register a new account → redirect to `/`.
3. Open `/calendar` — no redirect to login.
4. Refresh — still authenticated.
5. Logout → `/calendar` redirects to `/login?next=/calendar`.

---

## 5. Checklist

| Step | Pass |
|------|------|
| Config file path `/backend/railway.toml` | ☐ |
| Pre-deploy Alembic `f1a2b3c4d5e6` | ☐ |
| `GET /health` → 200 | ☐ |
| `verify-production-auth.sh` | ☐ |
| `verify-production-env.sh` (CORS preflight) | ☐ |
| Browser register/login/refresh/logout | ☐ |
| `FRONTEND_URL` matches frontend origin (no CORS errors in DevTools) | ☐ |
| `NEXT_PUBLIC_API_URL` points to API (not localhost) | ☐ |

---

## 6. Optional: Railway CLI

```bash
cd backend
railway link          # select project + ontrack-back service
railway variables     # confirm DATABASE_URL, FRONTEND_URL (do not paste secrets in tickets)
railway logs          # inspect latest pre-deploy + runtime
```

---

## Related

- [`.github/DEPLOY.md`](../../.github/DEPLOY.md)
- [`RAILWAY_BACKEND_MIGRATION.md`](./RAILWAY_BACKEND_MIGRATION.md)
- [`docs/CRA_NEXT_FULL_REGRESSION_AUDIT.md`](../CRA_NEXT_FULL_REGRESSION_AUDIT.md)
