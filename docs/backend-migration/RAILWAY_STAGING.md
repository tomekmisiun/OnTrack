# Railway staging — FastAPI (MIG-014)

Deploy FastAPI to Railway **staging** with a **clone** of production Postgres. Flask production (`ontrack-back`) stays live.

---

## Services (recommended names)

| Railway service | Config file | Purpose |
|-----------------|-------------|---------|
| `ontrack-back-fastapi-staging` | `backend/railway.toml` | FastAPI API (uvicorn) |
| `ontrack-worker-staging` | `backend/railway.worker.toml` | Redis worker (catalog seed) |
| `ontrack-redis-staging` | Railway Redis plugin | Job queue |
| `ontrack-postgres-staging` | **Clone** of prod Postgres | Never attach live prod on first deploy |

Optional: staging frontend with `REACT_APP_API_URL` → staging FastAPI URL.

---

## Prerequisites

- MIG-013 merged (`backend-test` CI green)
- Railway project with existing Flask prod (`ontrack-back`, `ontrackapp`)
- Production secrets available to copy into staging (JWT must match Flask for login parity tests)

---

## 1. Clone database

**Never** point the first FastAPI deploy at live production Postgres.

1. Railway → production Postgres → **Backups** → restore to a **new** database, **or**
2. Manual: `pg_dump` prod → restore into new Railway Postgres service `ontrack-postgres-staging`

Record the clone service name; staging `DATABASE_URL` must reference **only** this clone.

---

## 2. Redis (worker)

1. Add **Redis** plugin → name `ontrack-redis-staging`
2. Note `REDIS_URL` for worker service variables

Without Redis, catalog seed runs synchronously in the API process (acceptable for initial smoke).

---

## 3. FastAPI API service

1. **New service** → connect GitHub repo `OnTrack`
2. **Settings → Source**
   - Branch: `main` (after MIG-014 merge) or feature branch for first trial
   - **Root Directory:** `.` (repository root — required for monorepo assets)
   - **Config file path:** `backend/railway.toml` (or paste equivalent in UI)
3. **Settings → Deploy**
   - Health check path: `/health`
   - **Wait for CI:** ON (after branch protection includes `backend-test`)
4. **Variables** (copy from Flask prod where noted):

| Variable | Required | Value |
|----------|----------|-------|
| `DATABASE_URL` | Yes | `${{ontrack-postgres-staging.DATABASE_URL}}` — **clone only** |
| `JWT_SECRET_KEY` | Yes | Same as Flask prod (session continuity tests) |
| `FLASK_SECRET_KEY` | Yes | Same as Flask prod (OAuth session cookie) |
| `FRONTEND_URL` | Yes | Staging frontend URL or prod frontend for API-only smoke |
| `GOOGLE_CLIENT_ID` | If OAuth | Staging or prod creds (see Google Console redirect) |
| `GOOGLE_CLIENT_SECRET` | If OAuth | |
| `GOOGLE_REDIRECT_URI` | Yes | `https://<staging-api-domain>/api/auth/google/callback` |
| `GEMINI_API_KEY` | Optional | Import / images |
| `PEXELS_API_KEY` | Optional | Recipe images |
| `REDIS_URL` | Optional | `${{ontrack-redis-staging.REDIS_URL}}` if worker enabled |
| `PORT` | Auto | Set by Railway |

5. Deploy → verify:

```bash
curl -sf "https://<staging-api-domain>/health"
# → {"status":"ok"}
```

---

## 4. Worker service

1. **New service** → same repo, **Root Directory:** `.`
2. **Config file path:** `backend/railway.worker.toml`
3. **Variables:** `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET_KEY`, `FLASK_SECRET_KEY` (same as API)
4. No public domain required; no health check path

---

## 5. Image layout

`backend/Dockerfile.railway` builds from **repository root** so runtime paths match local dev:

```text
/app/                          ← _repo_root()
  backend/app/                 ← FastAPI package
  app/user_seeds/data/
  app/dish_compare/data/
  scraper/data/macros/
  scraper/data/built/
```

Local `docker compose` still uses `backend/Dockerfile` (backend-only context). Staging/production use `Dockerfile.railway`.

---

## 6. Migrations (MIG-015 — not on first deploy)

Do **not** run `alembic upgrade head` on the clone until MIG-015 rehearsal is signed off.

Runbook: **[DB_REHEARSAL.md](./DB_REHEARSAL.md)** — schema parity, `alembic stamp 7966d120d748`, smoke checklist.

---

## 7. Smoke checklist (staging)

After deploy:

- [ ] `GET /health` → 200 `{ "status": "ok" }`
- [ ] Register → `{ "token" }` → `GET /api/auth/me`
- [ ] Login existing user (Flask password hash)
- [ ] `GET /api/members/`
- [ ] Product CRUD
- [ ] `GET /api/public/dish-compare?lang=pl`
- [ ] Unauthorized `GET /api/products/` → 401
- [ ] Contract suite locally against staging URL (optional): `DATABASE_URL=... pytest tests/contract/`

Full list: [CUTOVER_AND_ROLLBACK.md](./CUTOVER_AND_ROLLBACK.md#smoke-tests-cutover-gate).

---

## 8. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Build fails `COPY app/user_seeds` | Root Directory must be repo root, not `backend/` |
| Health check timeout | Check logs; verify `DATABASE_URL` and secrets |
| `DATABASE_URL points at Docker host 'db'` | Use Railway Postgres reference, not compose URL |
| Dish compare / seed empty | Rebuild image; confirm monorepo COPY paths in Dockerfile.railway |
| OAuth redirect mismatch | Update Google Console + `GOOGLE_REDIRECT_URI` |

---

## Local validation (before Railway)

```bash
# From repository root
docker build -f backend/Dockerfile.railway -t ontrack-fastapi-railway .
docker run --rm -p 8000:8000 \
  -e DATABASE_URL=sqlite:// \
  -e FLASK_SECRET_KEY=dev \
  -e JWT_SECRET_KEY=dev \
  ontrack-fastapi-railway
curl -sf http://localhost:8000/health
```

CI runs the same `docker build` on every PR.
