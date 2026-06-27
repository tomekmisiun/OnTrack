# Deploy — GitHub Actions → Railway

Production deploys after a push to **`main`** when **all CI jobs pass**, via the **`deploy-production`** workflow job (`railway up`).

**Full runbook:** [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md)

---

## Railway services

| Service | Role | Root Directory | Config |
|---------|------|----------------|--------|
| `ontrack-back` | Production API (FastAPI) | `backend` | `/backend/railway.toml` |
| `ontrackapp` | Frontend (Next.js) | `frontend-next` | `/frontend-next/railway.toml` |
| Postgres | Primary database | — | Railway plugin |

---

## Developer workflow

```
feature branch → PR → CI → merge
push to main     → CI (all jobs green) → deploy-production → railway up (backend + frontend)
```

**Do not push directly to `main`.**

---

## GitHub secret

| Secret | Purpose |
|--------|---------|
| `RAILWAY_TOKEN` | Project token for `deploy-production` |

---

## Quick verification

```bash
curl -sf https://<ontrack-back-domain>/health/ready

API_URL=https://<ontrack-back-domain> FRONTEND_ORIGIN=https://<ontrackapp-domain> \
  ./backend/scripts/verify-production-auth.sh
```

---

## CI jobs

| Job | Purpose |
|-----|---------|
| `test` | Ruff, catalog validation, contract subset, OpenAPI drift |
| `frontend-next` | generate:api, Vitest, lint, typecheck, build |
| `frontend-next-e2e` | Playwright smoke |
| `frontend-next-e2e-auth` | Register/login against FastAPI + Postgres |
| `backend-docker` / `frontend-next-docker` | Docker image builds |
| `backend-integration` | DB migration rehearsal |
| `deploy-production` | **`main` only** — Railway deploy |
| `visual-regression` | Manual dispatch — Playwright screenshot suite (optional) |
| `production auth smoke` | Scheduled / manual — live register/login check |
| `staging auth smoke` | Manual dispatch — staging register/login check |

Full matrix: [`docs/TESTING.md`](../docs/TESTING.md)

---

## Branch protection

Recommended required checks: **`test`**, **`frontend-next`**
