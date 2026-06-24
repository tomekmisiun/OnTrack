# Cutover and rollback

Safe Railway migration: **Flask production stays live** until FastAPI is proven on staging with a **database clone**.

---

## Phases

### Phase 0 — Current state (confirmed)

- Production: Flask backend on Railway (`ontrack-back` per `.github/DEPLOY.md`)
- Frontend: separate Railway service; `REACT_APP_API_URL` → Flask URL
- CI: pytest on Flask only (`.github/workflows/ci.yml`)
- Local: `docker compose up` — Flask `app` on host `5001`, frontend `3000`

### Phase 1 — Parallel development (MIG-001 – MIG-013)

- Flask remains production and local default for full API
- FastAPI developed behind same route contracts
- Local: optional switch of host port `5001` to FastAPI container

### Phase 2 — Staging (MIG-014)

| Item | Action |
|------|--------|
| New Railway service | `ontrack-back-fastapi-staging` — config `backend/railway.toml` |
| Worker + Redis | `ontrack-worker-staging` + `ontrack-redis-staging` — `backend/railway.worker.toml` |
| Database | **Clone** of production — never first test on live |
| Build | `docker build backend` — Root Directory `backend` on Railway |
| Frontend staging | Optional staging frontend with `REACT_APP_API_URL` → staging FastAPI |
| Migrations | [DB_REHEARSAL.md](./DB_REHEARSAL.md) — stamp on clone after parity check |
| Validation | Full contract suite + manual smoke |

Runbook: **[RAILWAY_STAGING.md](./RAILWAY_STAGING.md)**

DB rehearsal: **[DB_REHEARSAL.md](./DB_REHEARSAL.md)**

### Phase 3 — Rehearsal (MIG-015)

Runbook on fresh clone:

1. `pg_dump --schema-only` prod → diff against SQLAlchemy models
2. `pg_dump --data-only` sample verification queries (row counts)
3. Backup restore drill
4. `alembic stamp <ontrack_head>` on clone with preconditions checklist
5. Smoke: register, login, OAuth (staging Google creds), CRUD, meal plan
6. Rollback drill: revert service image to Flask, confirm Flask still works against **same** DB (no schema change)

### Phase 4 — Production cutover (MIG-016)

**Preferred:** Switch routing without DB migration risk (schema unchanged).

Runbook: **[PRODUCTION_CUTOVER.md](./PRODUCTION_CUTOVER.md)**

```
┌──────────────┐     ┌─────────────────┐
│   Frontend   │────▶│ FastAPI (prod)  │  NEW
│   Railway    │     │ same DATABASE_URL│
└──────────────┘     └─────────────────┘
                            │
                     ┌──────▼──────┐
                     │  Postgres   │  unchanged schema
                     └─────────────┘

Flask service: scaled to 0 / standby image — NOT deleted
```

| Step | Action |
|------|--------|
| 1 | Maintenance window (optional) or low-traffic window |
| 2 | Final prod backup |
| 3 | Deploy FastAPI with **same** `DATABASE_URL`, `JWT_SECRET_KEY`, OAuth vars |
| 4 | `alembic stamp` only if rehearsed — **no CREATE TABLE on prod** |
| 5 | Update frontend `REACT_APP_API_URL` to FastAPI URL (rebuild frontend) |
| 6 | Smoke checklist (below) |
| 7 | Monitor errors 24–72h |

### Phase 5 — Decommission Flask (MIG-017)

After stability period — remove Flask service and legacy code from repo.

---

## Environment variables (FastAPI production)

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | `${{Postgres.DATABASE_URL}}` private — **not** `DATABASE_PUBLIC_URL` |
| `JWT_SECRET_KEY` | Yes | **Same value as Flask** for session continuity |
| `APP_SECRET_KEY` / `FLASK_SECRET_KEY` | Yes | Cookie signing for OAuth `pending_lang` |
| `FRONTEND_URL` | Yes | CORS + redirects |
| `GOOGLE_REDIRECT_URI` | Yes | Must match Google Console |
| `GOOGLE_CLIENT_ID` | If OAuth enabled | |
| `GOOGLE_CLIENT_SECRET` | If OAuth enabled | |
| `AUTH_CODE_TTL_SECONDS` | Optional | Default 120 |
| `GEMINI_API_KEY` | Optional | Import |
| `PEXELS_API_KEY` | Optional | Images |
| `DEEPSEEK_API_KEY` | Optional | Macros |
| `REDIS_URL` | If worker enabled | MIG-012+ |
| `PORT` | Railway sets | uvicorn bind |

Frontend build-time:

| Variable | Value |
|----------|-------|
| `REACT_APP_API_URL` | `https://<fastapi-prod-domain>` |

---

## Port mapping (local)

**Confirmed** frontend default: `http://localhost:5001` (`frontend/src/api.js`).

```yaml
backend:
  ports:
    - "5001:8000"
```

Flask during migration:

```yaml
app:  # legacy
  ports:
    - "5002:5000"
```

---

## Health checks

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Liveness — match Flask `{ "status": "ok" }` |
| `GET /health/ready` | Readiness — DB connect (foundation pattern) **ADAPT** |

Railway healthcheck: use `/health` initially for parity; add `/health/ready` when DB required at start.

---

## Migration command (production)

```bash
# Only after MIG-015 rehearsal signed off:
alembic stamp <ontrack_baseline_revision>
# OR if no-op upgrade needed:
alembic upgrade head
```

**Never** run template foundation migrations.

Startup script should mirror `scripts/start-production.sh`: migrate then uvicorn/gunicorn.

---

## Worker process

| Environment | Processes |
|-------------|-----------|
| Staging/prod (post MIG-012) | `api` + `worker` Railway services |
| Cutover minimum | API only if worker not ready — sync seed acceptable temporarily |

---

## Smoke tests (cutover gate)

- [ ] `GET /health` → 200
- [ ] Register new user → `{ token }` → `GET /api/auth/me`
- [ ] Login existing user (password hash from before cutover)
- [ ] Google OAuth full flow (production credentials)
- [ ] `GET /api/members/`
- [ ] Product CRUD
- [ ] Recipe CRUD + list summary shape
- [ ] Meal plan add/list/summary
- [ ] Day schedule create/list
- [ ] `GET /api/public/dish-compare?lang=pl`
- [ ] Unauthorized `GET /api/products/` → 401
- [ ] Frontend manual: calendar, export, macro calculator load

---

## Rollback triggers

| Trigger | Action |
|---------|--------|
| Error rate spike | Revert frontend `REACT_APP_API_URL` to Flask URL |
| Auth failures | Rollback FastAPI deploy; verify `JWT_SECRET_KEY` |
| Data corruption suspicion | Stop FastAPI; restore DB from pre-cutover backup |
| OAuth redirect break | Rollback; verify `GOOGLE_REDIRECT_URI` + cookies |

---

## Rollback procedure

1. Redeploy previous **frontend** build with Flask API URL (or revert env var).
2. Scale FastAPI service to 0 / rollback image on Railway.
3. Ensure Flask service running with original `DATABASE_URL`.
4. If `alembic upgrade` was applied (non stamp-only): execute documented `downgrade` on staging first — **do not guess on prod**.
5. Post-incident: update `docs/backend-migration/` with findings.

---

## CORS

FastAPI must allow:

- `FRONTEND_URL` origin(s)
- Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
- Headers: `Authorization`, `Content-Type`

---

## Monitoring post-cutover

| Signal | Tool |
|--------|------|
| 5xx rate | Railway logs / Prometheus |
| 401 spike | Auth misconfiguration |
| Latency | Prometheus (already in local compose) |
| DB connections | Railway Postgres metrics |

---

## What not to do

- Point first FastAPI deploy at **live** production DB without rehearsal
- Delete Flask service before stability period
- Change JWT secret during cutover window
- Modify frontend components during cutover PR

---

## Unresolved questions

| ID | Question |
|----|----------|
| CQ1 | ~~Exact Railway service names~~ → `ontrack-back-fastapi-staging`, `ontrack-worker-staging`, `ontrack-redis-staging`, `ontrack-postgres-staging` (see RAILWAY_STAGING.md) |
| CQ2 | Whether frontend and backend share a domain/path proxy vs separate URLs |
| CQ3 | Google OAuth staging credentials vs production |
