# Deploy — Wait for CI (Railway + GitHub Actions)

Production deploys from Railway after a push to `main`, **but only when GitHub Actions passes**. You do not need Railway secrets in GitHub.

## Railway services

### After MIG-016 cutover (target)

| Service | Role | Config |
|---------|------|--------|
| `ontrack-back-fastapi` | **Live API** (FastAPI) | `backend/railway.prod.toml` |
| `ontrack-worker` | Background worker | `backend/railway.worker.prod.toml` |
| `ontrackapp` | Frontend SPA | `frontend/railway.toml` |
| `ontrack-back` | Flask **standby** (rollback) | root `railway.toml` |
| Postgres + Redis | Data + queue | Railway plugins |

Cutover runbook: [`docs/backend-migration/PRODUCTION_CUTOVER.md`](../docs/backend-migration/PRODUCTION_CUTOVER.md)

### Before cutover (legacy)

| Service | Role |
|---------|------|
| `ontrack-back` | Flask API (live) |
| `ontrackapp` | Frontend — `REACT_APP_API_URL` → Flask URL |

Staging FastAPI: [`docs/backend-migration/RAILWAY_STAGING.md`](../docs/backend-migration/RAILWAY_STAGING.md)

---

## 1. Railway — configure each service

For **each** service → **Settings** → **Source**:

1. **Source Repo** — connected to `tomekmisiun/OnTrack`
2. **Branch connected to production** → **`main`**
3. **Auto deploys when pushed to GitHub** — **enabled**
4. **Wait for CI** → **ON**
5. FastAPI services: **Root Directory** = `.` (repo root), config path as in table above

Click **Apply** / **Deploy** if Railway shows pending changes.

### Frontend build variable

`ontrackapp` requires at build time:

```
REACT_APP_API_URL=https://<your-api-domain>
```

After cutover this must point to **`ontrack-back-fastapi`**, not Flask.

---

## 2. GitHub Actions

Workflow `.github/workflows/ci.yml`:

| Job | Purpose |
|-----|---------|
| `test` | Flask pytest (branch protection) |
| `backend-test` | FastAPI contract suite |
| `backend-docker` | Railway image build |
| `backend-integration` | DB stamp rehearsal |

```
push to main → CI jobs
                 ✅ → Railway waits and deploys from GitHub
                 ❌ → Railway skips deploy (SKIPPED)
```

PR to `main` → CI only, no deploy.

---

## 3. Branch protection (GitHub)

**Settings → Branches → Add rule** for `main`:

- Require a pull request before merging
- Require status checks to pass: **`test`**

---

## 4. Developer workflow

```
feature branch → Pull Request → CI
                               → merge after review + green CI
push to main     → CI → Railway deploy (Wait for CI)
```

**Do not push directly to `main`.**

---

## 5. Local vs production

| Environment | How to run |
|-------------|------------|
| Dev | `docker compose up` |
| Production | merge to `main` + green CI → Railway auto-deploy |

---

## Troubleshooting

- Deploy does not start after push → check branch `main` connected and Wait for CI enabled
- Deploy despite failed CI → Wait for CI is off or workflow missing `on: push: branches: [main]`
- Status `WAITING` in Railway → normal; waiting for GitHub Actions
- API 401 after cutover → `JWT_SECRET_KEY` must match pre-cutover Flask value
- OAuth redirect error → update `GOOGLE_REDIRECT_URI` and Google Console for FastAPI domain

Docs: [Railway — Wait for CI](https://docs.railway.com/deployments/github-autodeploys#wait-for-ci)
