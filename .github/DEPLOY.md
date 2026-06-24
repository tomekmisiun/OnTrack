# Deploy — Wait for CI (Railway + GitHub Actions)

Production deploys from Railway after a push to `main`, **but only when GitHub Actions passes**.

## Railway services

| Service | Role | Config |
|---------|------|--------|
| `ontrack-back` | Production API (FastAPI) | root `railway.toml` (repo root, empty Root Directory) |
| `ontrack-back-fastapi` | Alt. name (same config) | `backend/railway.prod.toml` |
| `ontrack-worker` | Background worker | `backend/railway.worker.prod.toml` |
| `ontrackapp` | Frontend SPA | `frontend/railway.toml` |
| Postgres + Redis | Data + queue | Railway plugins |

**MIG-017:** Delete legacy `ontrack-back` (Flask) Railway service after cutover stability period.

Cutover runbook: [`docs/backend-migration/PRODUCTION_CUTOVER.md`](../docs/backend-migration/PRODUCTION_CUTOVER.md)

---

## 1. Railway — configure each service

For **each** service → **Settings** → **Source**:

1. **Source Repo** — connected to `tomekmisiun/OnTrack`
2. **Branch connected to production** → **`main`**
3. **Auto deploys when pushed to GitHub** — **enabled**
4. **Wait for CI** → **ON**
5. **ontrack-back:** Root Directory **empty** (repo root) — uses root `railway.toml` automatically
6. **ontrackapp:** Root Directory = `frontend` — uses `frontend/railway.toml`

### Frontend build variable

```
REACT_APP_API_URL=https://<ontrack-back-fastapi-domain>
```

---

## 2. GitHub Actions

| Job | Purpose |
|-----|---------|
| `test` | FastAPI contract + health tests (branch protection) |
| `backend-docker` | Railway image build |
| `backend-integration` | DB stamp rehearsal (Postgres) |

---

## 3. Branch protection

Require status check: **`test`**

---

## 4. Developer workflow

```
feature branch → PR → CI → merge
push to main     → CI → Railway deploy (Wait for CI)
```

**Do not push directly to `main`.**

Docs: [Railway — Wait for CI](https://docs.railway.com/deployments/github-autodeploys#wait-for-ci)
