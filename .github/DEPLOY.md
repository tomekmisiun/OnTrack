# Deploy — Wait for CI (Railway + GitHub Actions)

Production deploys from Railway after a push to `main`, **but only when GitHub Actions passes**.

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
3. **Auto deploys when pushed to GitHub** — **enabled**
4. **Wait for CI** → **ON**
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

---

## 3. Branch protection

Require status checks: **`test`**, **`frontend-next`** (recommended)

---

## 4. Developer workflow

```
feature branch → PR → CI → merge
push to main     → CI → Railway deploy (Wait for CI)
```

**Do not push directly to `main`.**

Docs: [Railway — Wait for CI](https://docs.railway.com/deployments/github-autodeploys#wait-for-ci)

---

## 6. Deploy runbook — SKIPPED deployments

Railway may record a deployment as **SKIPPED** when a push to `main` arrives while CI is still running (Wait for CI). The service keeps the **previous** deployment until a successful deploy completes.

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

- Confirm **Wait for CI** is enabled on each production service.
- After merging to `main`, wait for the CI workflow to finish before assuming production updated.
- Optional: add a post-merge deploy smoke job or monitor Railway deployment status in release notes.

---

## 7. Rollback (CRA → Next.js cutover)

If the Next.js frontend deploy causes issues:

1. **Railway `ontrackapp`:** redeploy the last known-good deployment from the Railway dashboard, **or** temporarily set Root Directory back to a git tag/commit that still contains `frontend/` (pre–task 15).
2. **Build variable:** restore `REACT_APP_API_URL=https://<ontrack-back-domain>` for the CRA image; for Next.js use `NEXT_PUBLIC_API_URL`.
3. **Backend:** no change required — FastAPI API contract is unchanged.
4. **Local dev:** `git checkout <pre-cutover-tag>` and `docker compose up --build frontend` if you need the legacy CRA stack.

Document the rollback commit hash in your release notes when merging task 15.
