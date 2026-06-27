# Deployment

**Last verified:** 2026-06-27

Production runs on **Railway**. Deploys are triggered by GitHub Actions after CI passes on **`main`** — not by direct pushes to Railway auto-deploy (recommended OFF).

Quick reference for CI operators: [`.github/DEPLOY.md`](../.github/DEPLOY.md)

---

## Railway services

| Service | Role | Root Directory | Config file |
|---------|------|----------------|-------------|
| `ontrack-back` | FastAPI API | `backend` | `/backend/railway.toml` |
| `ontrackapp` | Next.js frontend | `frontend-next` | `/frontend-next/railway.toml` |
| Postgres | Database | — | Railway plugin |

---

## Deploy flow

```text
feature branch → PR → CI (all jobs) → merge to main
push to main
  → CI (7 jobs)
  → deploy-staging          (GitHub Environment: staging, Railway environment: staging)
  → wait-staging-ready      (poll STAGING_API_URL/health/ready)
  → staging-smoke           (verify-production-auth.sh)
  → deploy-production       (GitHub Environment: production — manual approval required)
  → production-smoke        (readiness + verify-production-auth.sh)
```

Defined in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). There is no deploy branch and no `git push` to promote between environments — both deploy jobs use **`github.sha`** from the same workflow run.

Quick operator guide: [`.github/DEPLOY.md`](../.github/DEPLOY.md)

### GitHub Environments

| Environment | When used | Required secrets |
|-------------|-----------|------------------|
| `staging` | Auto after green CI on `main` | `RAILWAY_TOKEN`, `STAGING_API_URL`, `STAGING_FRONTEND_ORIGIN` |
| `production` | After staging smoke + manual approval | `RAILWAY_TOKEN`, `PRODUCTION_API_URL`, `PRODUCTION_FRONTEND_ORIGIN` |

Configure under **Settings → Environments → production → Required reviewers**.

### Railway environments

One Railway **project**, two **environments**: `staging` and `production`. Each has its own Postgres plugin, service variables, and public domains. CI deploy commands:

```bash
railway up --environment staging --service ontrack-back --ci
railway up --environment production --service ontrackapp --ci
```

Deploy runs from the **repository root**; Railway service settings (Root Directory `backend` / `frontend-next`) select the build context.

**Auto deploy on Railway:** OFF for both environments — GitHub Actions is the only deploy path.

### Concurrency

| Group | Policy | Rationale |
|-------|--------|-----------|
| `deploy-staging-main` | cancel in-progress | New merge superseded stale staging deploy |
| `deploy-production-main` | do not cancel | Approved run keeps its SHA even if `main` moves forward |

### Migrations

`backend/railway.toml` `preDeployCommand` runs on every Railway deploy. Staging deploys migrate **staging Postgres only**; production migrates **production Postgres** only after approval. There is no cross-environment `DATABASE_URL` in CI — isolation is enforced by Railway environment-scoped variables and tokens.

---

## Required variables

### `ontrack-back`

| Variable | Note |
|----------|------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `JWT_SECRET_KEY` | Required |
| `FLASK_SECRET_KEY` | Required (OAuth session cookie) |
| `FRONTEND_URL` | Exact browser origin of `ontrackapp` (no trailing slash) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional OAuth |
| `GOOGLE_REDIRECT_URI` | `https://<ontrack-back>/api/auth/google/callback` |
| `SMTP_HOST`, `SMTP_FROM`, `SMTP_USER`, `SMTP_PASSWORD` | Optional — password reset emails |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE` | Optional — error tracking (see [SECURITY.md](./SECURITY.md)) |
| API keys (Gemini, Pexels, DeepSeek) | Optional |

Healthcheck: `/health` (120s timeout in `railway.toml`)

### `ontrackapp`

| Variable | Note |
|----------|------|
| `NEXT_PUBLIC_API_URL` | Public `ontrack-back` URL — **build-time** variable |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional — client error tracking |
| `SENTRY_ENVIRONMENT` | Optional — e.g. `production` or `staging` |

Healthcheck: `/login` (120s timeout)

Remove legacy `REACT_APP_API_URL` if present.

---

## Pre-deploy migrations

`backend/railway.toml`:

```toml
[deploy]
preDeployCommand = "sh scripts/run-migrations.sh"
```

Script steps (`backend/scripts/run-migrations.sh`):

1. `ensure_alembic_head.py` — Alembic upgrade to head
2. `import_catalog` — refresh global catalog from `backend/data/`
3. `restore_post_catalog_migration` — restore user references after catalog import

If pre-deploy exits non-zero, Railway aborts the deployment. Check **Pre-deploy** logs in the deployment view.

Expected Alembic head at time of writing: **`d3e4f5a6b7c8`**

---

## Post-deploy verification

### Health

```bash
curl -sf "https://<ontrack-back-domain>/health"
curl -sf "https://<ontrack-back-domain>/health/ready"
curl -sf "https://<ontrack-back-domain>/metrics" | head
curl -sf "https://<ontrack-back-domain>/api/public/dish-compare?lang=pl"
```

### Auth smoke

```bash
API_URL=https://<ontrack-back-domain> FRONTEND_ORIGIN=https://<ontrackapp-domain> \
  ./backend/scripts/verify-production-auth.sh
```

Expect exit code **0** — register 201, `/me` 200, login 200. Script does not print JWT values.

Run after every production deploy or when changing `FRONTEND_URL` / JWT secrets.

### Scheduled GitHub smoke (optional)

Workflow [`.github/workflows/production-smoke.yml`](../.github/workflows/production-smoke.yml) runs every 6 hours and on manual dispatch. Uses GitHub Environment **`production`** secrets (`PRODUCTION_API_URL`, `PRODUCTION_FRONTEND_ORIGIN`). Skips if URL is unset. This is **separate from** the mandatory **`production-smoke`** job in `ci.yml` (runs after each production deploy).

### Browser checks

1. Open `ontrackapp` → register or login
2. Navigate calendar / recipes — no CORS errors in console
3. Google OAuth (if configured) completes redirect loop

---

## Troubleshooting

| Symptom | Likely fix |
|---------|------------|
| Frontend build: Dockerfile not found | Root Directory must be `frontend-next` |
| Missing `NEXT_PUBLIC_API_URL` | Add on `ontrackapp` Variables, redeploy |
| Healthcheck timeout on frontend | Check deploy logs for `node server.js`; `/login` must return 200 |
| API calls fail from browser | `NEXT_PUBLIC_API_URL` must match public backend URL |
| CORS on register/login | `FRONTEND_URL` on backend must match browser origin exactly |
| 500 after deploy | Check pre-deploy migration logs |
| SKIPPED Railway deployments | Turn OFF Auto deploy on Railway; use CI deploy jobs only |
| Pre-deploy FK errors on catalog import | Ensure `restore_post_catalog_migration` runs (included in script since `b1c2d3e4f5a6`) |

### Manual redeploy (emergency)

Use the same SHA-aware flow via GitHub Actions re-run, or Railway CLI with the correct environment:

```bash
railway up --environment staging --service ontrack-back --ci
railway up --environment production --service ontrackapp --ci
```

Do not deploy production without passing staging smoke for the same commit.

---

## Rollback

1. Railway dashboard → select service → **Deployments** → redeploy last known-good deployment
2. Document rollback commit in release notes
3. If DB migration was applied, assess whether Alembic downgrade is required (usually avoid in prod)

Frontend rollback does not change API contract between adjacent releases.

---

## UI release checklist

Run when merging visible UI changes (login, navigation, module layouts):

1. **Local visual suite** (mocked API, four viewports):

   ```bash
   cd frontend-next && npm run test:e2e:visual
   ```

2. **If diffs are intentional**, update baselines and commit snapshot files under `frontend-next/tests/e2e/visual-screenshots.spec.ts-snapshots/`:

   ```bash
   npm run test:e2e:visual:update
   ```

3. **Optional CI confirmation:** GitHub → Actions → **Visual regression** → Run workflow.

Visual tests are **not** required for PR merge or production deploy. See [TESTING.md](./TESTING.md#visual-regression-optional).

---

## Emergency backend rollback (archive)

One-time migration moved build context from repo root to `backend/`. Rollback to pre-migration layout requires restoring old `railway.toml` and Dockerfile paths from git history — only for emergencies. Current production uses `backend/railway.toml` + `backend/Dockerfile`.

---

## Branch protection

Recommended required checks on `main`: **`test`**, **`frontend-next`**

Full CI matrix: [TESTING.md](./TESTING.md)

---

## Staging

Staging is the **Railway environment `staging`** in the same project as production (not a separate project). GitHub Actions deploys staging automatically on every green CI run on `main`.

### Staging URLs and variables

Configure per-service variables on Railway **environment staging** (mirrors production layout):

| Variable (backend) | Staging note |
|--------------------|--------------|
| `DATABASE_URL` | Staging Postgres only |
| `JWT_SECRET_KEY`, `FLASK_SECRET_KEY` | Unique — not production values |
| `FRONTEND_URL` | Staging frontend origin |
| `GOOGLE_REDIRECT_URI` | Staging API callback URL |

| Variable (frontend) | Staging note |
|---------------------|--------------|
| `NEXT_PUBLIC_API_URL` | Staging API URL (build-time) |

GitHub Environment **`staging`** must define `STAGING_API_URL` and `STAGING_FRONTEND_ORIGIN` for readiness polling and smoke tests (no trailing slash on API URL).

### Verify staging locally

```bash
API_URL=https://<staging-api> FRONTEND_ORIGIN=https://<staging-frontend> \
  ./backend/scripts/verify-production-auth.sh
```

DB migration rehearsal on a clone: [DB_REHEARSAL.md](./backend-migration/DB_REHEARSAL.md)

### Supplementary workflow

[`.github/workflows/staging-smoke.yml`](../.github/workflows/staging-smoke.yml) — manual dispatch only; the release gate is job **`staging-smoke`** in `ci.yml`.

---

## Normal release (operator checklist)

1. Merge PR to `main` (CI must pass on the PR first).
2. Open **Actions → CI/CD Pipeline** for the merge commit.
3. Confirm jobs through **Staging auth smoke** are green.
4. Click **Review deployments** → approve **production**.
5. Confirm **Production auth smoke (post-deploy)** passes.
6. Optional: spot-check staging/production URLs in the browser.

### If staging smoke fails

- Do **not** approve production.
- Open the failed job log (deploy, readiness, or smoke).
- Fix forward on a new branch/PR, or cancel the workflow run under **Actions**.
- To stop a bad staging deploy: Railway dashboard → staging environment → redeploy last good deployment or scale down.

### Cancel a deployment

- **Before production approval:** cancel the workflow run in GitHub Actions — production will not start.
- **After approval:** let the job finish or cancel from Actions (Railway may still complete an in-flight deploy — check Railway deployment view).

### Check deployed SHA

In the workflow run:

- Each deploy job logs `Deploying commit <sha>` and verifies `git rev-parse HEAD`.
- Railway deployment details show the uploaded source; cross-check with the GitHub commit on the run page.

### Rollback

1. Railway → select environment (`staging` or `production`) → service → **Deployments** → redeploy last known-good deployment.
2. Document the rollback in release notes.
3. If a migration broke production, assess Alembic downgrade separately (avoid ad-hoc prod downgrades).

There is **no** git-based promotion between environments.

---

## Docker images (CI validation)

CI builds but does not push images:

- `docker build backend`
- `docker build -f frontend-next/Dockerfile.railway frontend-next`

Local Compose uses `frontend-next/Dockerfile` (dev target) and `backend/Dockerfile`.
