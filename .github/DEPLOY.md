# Deploy — GitHub Actions → Railway

Production deploys after a push to **`main`** when **all CI jobs pass**, via the **`deploy-production`** workflow job (`railway up`).

## Railway services

| Service | Role | Root Directory | Config |
|---------|------|----------------|--------|
| `ontrack-back` | Production API (FastAPI) | `backend` | `/backend/railway.toml` |
| `ontrackapp` | Frontend (Next.js) | `frontend-next` | `frontend-next/railway.toml` |
| Postgres | Primary database | — | Railway plugin |

Background worker and Redis were **removed** per [`docs/adr/0002-background-worker.md`](../docs/adr/0002-background-worker.md). Decommission any legacy `ontrack-worker` or Redis plugin services in the Railway dashboard if still present.

Backend migration runbook: [`docs/deployment/RAILWAY_BACKEND_MIGRATION.md`](../docs/deployment/RAILWAY_BACKEND_MIGRATION.md)

Production auth verification: [`docs/deployment/RAILWAY_AUTH_PRODUCTION_VERIFY.md`](../docs/deployment/RAILWAY_AUTH_PRODUCTION_VERIFY.md)

---

## 1. Railway — configure each service

For **each** service → **Settings** → **Source**:

1. **Source Repo** — connected to `tomekmisiun/OnTrack`
2. **Branch connected to production** → **`main`**
3. **Auto deploy when pushed to GitHub** — **OFF** recommended (deploy via GitHub Actions §5; avoids duplicate/SKIPPED builds)
4. **Wait for CI** → **OFF** (CI job `deploy-production` is the deploy gate)
5. **ontrack-back:** Root Directory = **`backend`**, Config file path = **`/backend/railway.toml`**
6. **ontrackapp:** Root Directory = **`frontend-next`**, Config file path = **`/frontend-next/railway.toml`**

### Frontend build variable

Set at **build time** (baked into the Next.js client bundle):

```
NEXT_PUBLIC_API_URL=https://<ontrack-back-domain>
```

Remove legacy `REACT_APP_API_URL` if still present.

### Frontend troubleshooting (deploy fails)

| Symptom | Fix |
|---------|-----|
| Build: directory / Dockerfile not found | **Root Directory** must be `frontend-next` |
| Build: missing `NEXT_PUBLIC_API_URL` | Add variable on `ontrackapp` → **Variables**, redeploy |
| Build uses dev server / wrong stage | Config must point to `Dockerfile.railway` |
| Healthcheck timeout | `/login` must return 200; check deploy logs for `node server.js` |
| App loads but API fails | `NEXT_PUBLIC_API_URL` must be the public `ontrack-back` URL |
| Register/login CORS errors | `FRONTEND_URL` on `ontrack-back` must match browser origin exactly |
| 500 on register after deploy | Check pre-deploy migration logs in Railway |
| GraphQL / CLI timeout during deploy | Retry `railway up`; confirm `RAILWAY_TOKEN` and network |

After changing Root Directory or variables: **Deployments → Redeploy**.

---

## 2. GitHub Actions

| Job | Purpose |
|-----|---------|
| `test` | Ruff, catalog validation, contract subset, OpenAPI drift |
| `frontend-next` | generate:api, schema.ts drift, Vitest, lint, typecheck, build |
| `frontend-next-e2e` | Playwright smoke tests |
| `frontend-next-e2e-auth` | Playwright register/login against FastAPI + Postgres |
| `frontend-next-docker` | Production Docker image build |
| `backend-docker` | `docker build backend` validation |
| `backend-integration` | DB stamp rehearsal (Postgres) |
| `deploy-production` | **`main` only** — `railway up` for `ontrack-back` + `ontrackapp` after green CI |

Full matrix: [`docs/TESTING.md`](../docs/TESTING.md)

---

## 3. Branch protection

Require status checks: **`test`**, **`frontend-next`** (recommended)

---

## 4. Developer workflow

```
feature branch → PR → CI → merge
push to main     → CI (all jobs green) → deploy-production → railway up (backend + frontend)
```

**Do not push directly to `main`.**

---

## 5. GitHub Actions → Railway (production deploy)

After every push to **`main`**, job **`deploy-production`** uploads the **full repository**. Railway applies each service’s **Root Directory** and **Config file path**.

| Job | Deploys |
|-----|---------|
| `deploy-production` | `ontrack-back` + `ontrackapp` via `railway up --ci` |

### One-time setup: `RAILWAY_TOKEN`

1. Railway → project → **Settings** → **Tokens** → create **Project token**.
2. GitHub → repo **OnTrack** → **Settings** → **Secrets** → **`RAILWAY_TOKEN`**.

Without this secret, CI passes but **`deploy-production` fails**.

### CI concurrency on `main`

Workflow uses `cancel-in-progress: false` on **`main`** so merges are not invalidated mid-run.

---

## 6. Deploy runbook — SKIPPED deployments

If Railway **Auto deploy** + **Wait for CI** are still enabled, you may see **SKIPPED** deployments. **Preferred:** rely on **`deploy-production`** and turn both **OFF**.

### Manual redeploy

```bash
railway up --service=ontrack-back --detach
railway up --service=ontrackapp --detach
```

### Verification

```bash
API_URL=https://<ontrack-back-domain> FRONTEND_ORIGIN=https://<ontrackapp-domain> \
  ./backend/scripts/verify-production-auth.sh

curl -sf https://<ontrack-back-domain>/health/ready
curl -sf https://<ontrack-back-domain>/metrics | head
```

See [`docs/deployment/RAILWAY_AUTH_PRODUCTION_VERIFY.md`](../docs/deployment/RAILWAY_AUTH_PRODUCTION_VERIFY.md) for the full smoke runbook.

---

## 7. Rollback

If the Next.js frontend deploy causes issues, redeploy the last known-good Railway deployment from the dashboard. Backend API contract is unchanged between frontend releases.

Document the rollback commit hash in release notes.
