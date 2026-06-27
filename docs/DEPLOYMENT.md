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

```
feature branch → PR → CI (all jobs) → merge to main
push to main → CI (all jobs green) → deploy-production → railway up ×2
```

Job **`deploy-production`** (`.github/workflows/ci.yml`) runs only on `main` and deploys both services via `railway up --ci`.

### GitHub secret

| Secret | Purpose |
|--------|---------|
| `RAILWAY_TOKEN` | Project token for `deploy-production` |

Without it, CI passes but deploy job fails.

### Railway service settings

For each service → **Settings → Source**:

1. Source repo connected to GitHub
2. Production branch: **`main`**
3. **Auto deploy when pushed:** OFF (recommended)
4. **Wait for CI:** OFF (CI job is the gate)
5. Root Directory and config path as in table above

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

Workflow [`.github/workflows/production-smoke.yml`](../.github/workflows/production-smoke.yml) runs every 6 hours and on manual dispatch. It is **separate from PR CI** and uses repository secrets:

| Secret | Required | Example |
|--------|----------|---------|
| `PRODUCTION_API_URL` | Yes (otherwise job skips) | `https://<ontrack-back-domain>` |
| `PRODUCTION_FRONTEND_ORIGIN` | Recommended | `https://<ontrackapp-domain>` |

Configure under **Settings → Secrets and variables → Actions**. Without `PRODUCTION_API_URL`, scheduled runs exit successfully with a skip message.

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
| SKIPPED Railway deployments | Turn OFF Auto deploy + Wait for CI; use `deploy-production` only |
| Pre-deploy FK errors on catalog import | Ensure `restore_post_catalog_migration` runs (included in script since `b1c2d3e4f5a6`) |

### Manual redeploy

```bash
railway up --service=ontrack-back --detach
railway up --service=ontrackapp --detach
```

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

Staging is a **separate Railway project** (not auto-deployed from this repo). Use it to rehearse migrations, OAuth, and UI changes before production.

### Create the project

1. Railway → **New Project** → deploy from the same GitHub repo (`tomekmisiun/OnTrack`).
2. Add services mirroring production:

| Staging service | Root Directory | Config |
|-----------------|----------------|--------|
| `ontrack-back-staging` (or similar) | `backend` | `/backend/railway.toml` |
| `ontrackapp-staging` | `frontend-next` | `/frontend-next/railway.toml` |
| Postgres plugin | — | dedicated staging DB (empty or prod clone) |

3. **Auto deploy:** OFF on both services — deploy staging manually when needed (`railway up` against the staging project token).
4. Record public URLs (example placeholders — replace with your Railway domains):

| Role | Example URL |
|------|-------------|
| Staging API | `https://ontrack-back-staging.up.railway.app` |
| Staging frontend | `https://ontrackapp-staging.up.railway.app` |

### Staging variables

Copy production values, then override URLs and secrets:

**`ontrack-back-staging`**

| Variable | Staging note |
|----------|--------------|
| `DATABASE_URL` | Staging Postgres only — never point at production |
| `JWT_SECRET_KEY`, `FLASK_SECRET_KEY` | Unique values (not prod secrets) |
| `FRONTEND_URL` | Exact staging frontend origin |
| `GOOGLE_REDIRECT_URI` | `https://<staging-api>/api/auth/google/callback` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Separate OAuth client recommended |
| `SENTRY_DSN` / `SENTRY_ENVIRONMENT` | Optional — use `staging` environment tag |

**`ontrackapp-staging`**

| Variable | Staging note |
|----------|--------------|
| `NEXT_PUBLIC_API_URL` | Staging API URL (build-time) |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional — same Sentry project, `staging` environment |

### Deploy staging manually

```bash
# Link CLI to the staging Railway project first
railway up --service=ontrack-back-staging --detach
railway up --service=ontrackapp-staging --detach
```

Pre-deploy migrations run via `backend/railway.toml` the same as production.

### Verify staging

```bash
API_URL=https://<staging-api> FRONTEND_ORIGIN=https://<staging-frontend> \
  ./backend/scripts/verify-production-auth.sh
```

DB migration rehearsal on a **clone** DB: [DB_REHEARSAL.md](./backend-migration/DB_REHEARSAL.md)

### GitHub Actions smoke (optional)

Workflow [`.github/workflows/staging-smoke.yml`](../.github/workflows/staging-smoke.yml) — manual dispatch only.

| Secret | Purpose |
|--------|---------|
| `STAGING_API_URL` | Staging FastAPI base URL |
| `STAGING_FRONTEND_ORIGIN` | Staging browser origin (CORS) |

Without `STAGING_API_URL`, the workflow exits successfully with a skip message.

---

## Docker images (CI validation)

CI builds but does not push images:

- `docker build backend`
- `docker build -f frontend-next/Dockerfile.railway frontend-next`

Local Compose uses `frontend-next/Dockerfile` (dev target) and `backend/Dockerfile`.
