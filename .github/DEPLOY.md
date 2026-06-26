# Deploy — GitHub Actions → Railway

Production deploys after a push to **`main`** when **all CI jobs pass**, via the **`deploy-production`** workflow job (`railway up`).

## Railway services

| Service | Role | Root Directory | Config |
|---------|------|----------------|--------|
| `ontrack-back` | Production API (FastAPI) | `backend` | `/backend/railway.toml` |
| `ontrack-worker` | Background worker (optional) | `backend` | `/backend/railway.worker.prod.toml` |
| `ontrackapp` | Frontend (Next.js) | `frontend-next` | `frontend-next/railway.toml` |
| Postgres + Redis | Data + queue | — | Railway plugins |

Backend migration runbook: [`docs/deployment/RAILWAY_BACKEND_MIGRATION.md`](../docs/deployment/RAILWAY_BACKEND_MIGRATION.md)

Production auth verification: [`docs/deployment/RAILWAY_AUTH_PRODUCTION_VERIFY.md`](../docs/deployment/RAILWAY_AUTH_PRODUCTION_VERIFY.md)

---

## 1. Railway — configure each service

For **each** service → **Settings** → **Source**:

1. **Source Repo** — connected to `tomekmisiun/OnTrack`
2. **Branch connected to production** → **`main`**
3. **Auto deploy when pushed to GitHub** — **OFF** recommended (deploy via GitHub Actions §5; avoids duplicate/SKIPPED builds)
4. **Wait for CI** → **OFF**
5. **ontrack-back:** Root Directory = **`backend`**, Config file path = **`/backend/railway.toml`** (absolute from repo root — Config file path does not follow Root Directory)
6. **ontrackapp:** Root Directory = **`frontend-next`**, Config file path = **`/frontend-next/railway.toml`**

### Frontend build variable

Set at **build time** (baked into the Next.js client bundle). Railway passes service variables matching Dockerfile `ARG` names automatically.

```
NEXT_PUBLIC_API_URL=https://<ontrack-back-domain>
```

Remove legacy `REACT_APP_API_URL` if still present — CRA was removed in task 15.

### Frontend troubleshooting (deploy fails)

| Symptom | Fix |
|---------|-----|
| Build: directory / Dockerfile not found | **Root Directory** must be `frontend-next` (not `frontend` — deleted) |
| Build: missing `NEXT_PUBLIC_API_URL` | Add variable on `ontrackapp` → **Variables**, redeploy |
| Build uses dev server / wrong stage | Config must point to `Dockerfile.railway` (see `frontend-next/railway.toml`) |
| Healthcheck timeout | `/login` must return 200; check deploy logs for `node server.js` |
| App loads but API fails | `NEXT_PUBLIC_API_URL` must be the public `ontrack-back` URL (not localhost) |
| Register/login CORS errors | `FRONTEND_URL` on `ontrack-back` must match the browser origin exactly (scheme + host + port) |
| 500 on register after deploy | Run migrations once per release — `ontrack-back` uses `preDeployCommand` in `backend/railway.toml` |

After changing Root Directory or variables: **Deployments → Redeploy** (not just restart).

---

## 2. GitHub Actions

| Job | Purpose |
|-----|---------|
| `test` | FastAPI contract + health tests (branch protection) |
| `frontend-next` | Lint, unit tests, typecheck, build |
| `frontend-next-e2e` | Playwright smoke tests |
| `frontend-next-e2e-auth` | Playwright register/login against real FastAPI + Postgres |
| `frontend-next-docker` | Production Docker image build |
| `backend-docker` | `docker build backend` validation |
| `backend-integration` | DB stamp rehearsal (Postgres) |
| `deploy-production` | **`main` only** — `railway up` for `ontrack-back` + `ontrackapp` after green CI |

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

After every push to **`main`**, job **`deploy-production`** in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs **only when all CI jobs pass**:

| Job | Deploys |
|-----|---------|
| `deploy-production` | `ontrack-back` + `ontrackapp` via `railway up --ci` |

### One-time setup: `RAILWAY_TOKEN`

1. Railway → project **attractive-renewal** → **Settings** → **Tokens** → create **Project token** (production environment).
2. GitHub → repo **OnTrack** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
3. Name: **`RAILWAY_TOKEN`**, value: the project token.

Without this secret, CI still passes but **`deploy-production` fails** — add the token before merging deploy changes.

### CI concurrency on `main`

Workflow uses `cancel-in-progress: false` on **`main`** so a merge is not invalidated by the next push while CI is running. On PRs, in-progress runs are still cancelled.

---

## 6. Deploy runbook — SKIPPED deployments

If Railway **Auto deploy** + **Wait for CI** are still enabled, you may see **SKIPPED** when CI was cancelled or superseded. **Preferred fix:** rely on **`deploy-production`** (§5) and turn **Wait for CI** **OFF** on both services.

Legacy symptom (Wait for CI only):

### Symptoms

- GitHub Actions on `main` is green, but production behavior matches an older commit.
- Railway → **Deployments** shows latest entry **SKIPPED** with timestamp matching the merge push.

### Fix (manual)

From the repo root, with Railway CLI linked to the correct project:

```bash
# Backend (ontrack-back)
cd backend && railway up --detach

# Frontend (ontrackapp)
cd frontend-next && railway up --service ontrackapp --detach
```

Use `railway redeploy` only to restart the **same** image — it does **not** build new code. After code changes, use `railway up` or trigger a new GitHub deploy.

### Verification

```bash
API_URL=https://<ontrack-back-domain> FRONTEND_ORIGIN=https://<ontrackapp-domain> \
  ./backend/scripts/verify-production-auth.sh

curl -sf https://<ontrack-back-domain>/health/ready
curl -sf https://<ontrack-back-domain>/metrics | head
```

### Prevention

- Use **`deploy-production`** (§5) with **`RAILWAY_TOKEN`** configured.
- Turn **Wait for CI** **OFF** on `ontrack-back` and `ontrackapp`.
- After merge, confirm GitHub Actions job **`Deploy to Railway (production)`** succeeded, then verify `/health/ready` and `/api/auth/refresh` on production.

---

## 7. Rollback (CRA → Next.js cutover)

If the Next.js frontend deploy causes issues:

1. **Railway `ontrackapp`:** redeploy the last known-good deployment from the Railway dashboard, **or** temporarily set Root Directory back to a git tag/commit that still contains `frontend/` (pre–task 15).
2. **Build variable:** restore `REACT_APP_API_URL=https://<ontrack-back-domain>` for the CRA image; for Next.js use `NEXT_PUBLIC_API_URL`.
3. **Backend:** no change required — FastAPI API contract is unchanged.
4. **Local dev:** `git checkout <pre-cutover-tag>` and `docker compose up --build frontend` if you need the legacy CRA stack.

Document the rollback commit hash in your release notes when merging task 15.
