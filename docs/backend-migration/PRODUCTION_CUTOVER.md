# Production cutover — Flask → FastAPI (MIG-016)

Switch live traffic from Flask (`ontrack-back`) to FastAPI (`ontrack-back-fastapi`) **without schema changes**. Flask remains deployed as standby until MIG-017.

**Prerequisites:** MIG-015 signed off — [DB_REHEARSAL.md](./DB_REHEARSAL.md) completed on staging clone.

---

## Service map (after cutover)

| Service | Role | Config |
|---------|------|--------|
| `ontrack-back-fastapi` | **Production API** (live traffic) | `backend/railway.prod.toml` |
| `ontrack-worker` | Background jobs (catalog seed) | `backend/railway.worker.prod.toml` |
| `ontrack-redis` | Job queue | Railway Redis plugin |
| `ontrackapp` | Frontend — `REACT_APP_API_URL` → FastAPI | `frontend/railway.toml` |
| `ontrack-back` | Flask **standby** (scaled to 0 or idle) | root `railway.toml` / `Dockerfile` |
| Postgres | **Same** production DB | unchanged |

---

## Pre-flight checklist

- [ ] Staging rehearsal complete ([DB_REHEARSAL.md](./DB_REHEARSAL.md))
- [ ] `alembic stamp 7966d120d748` validated on **clone** (not first attempt on prod)
- [ ] Final production Postgres backup taken and verified
- [ ] FastAPI prod secrets ready — **copy from Flask** (`JWT_SECRET_KEY`, `FLASK_SECRET_KEY`)
- [ ] Google Console: new redirect URI for FastAPI prod domain added
- [ ] Team notified; low-traffic window (optional)

---

## Step 1 — Deploy FastAPI production services

### 1a. API service (`ontrack-back-fastapi`)

1. Railway → **New service** → connect repo
2. **Settings → Source**
   - Branch: `main`
   - **Root Directory:** `.` (repository root)
   - **Config file path:** `backend/railway.prod.toml`
3. **Wait for CI:** ON
4. **Variables** — copy from `ontrack-back` (Flask):

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` — **same prod DB** |
| `JWT_SECRET_KEY` | Same as Flask (required for existing sessions) |
| `FLASK_SECRET_KEY` | Same as Flask |
| `FRONTEND_URL` | `https://<ontrackapp-domain>` |
| `GOOGLE_CLIENT_ID` | Same as Flask |
| `GOOGLE_CLIENT_SECRET` | Same as Flask |
| `GOOGLE_REDIRECT_URI` | `https://<fastapi-prod-domain>/api/auth/google/callback` |
| `GEMINI_API_KEY` | Copy from Flask |
| `PEXELS_API_KEY` | Copy from Flask |
| `DEEPSEEK_API_KEY` | Copy from Flask |
| `REDIS_URL` | `${{ontrack-redis.REDIS_URL}}` when worker enabled |

5. Deploy → note public URL: `https://<fastapi-prod-domain>`

### 1b. Redis + worker (recommended)

1. Add Redis plugin → `ontrack-redis`
2. New service → `ontrack-worker` with `backend/railway.worker.prod.toml`
3. Same `DATABASE_URL`, `REDIS_URL`, secrets as API

---

## Step 2 — Alembic stamp on production

Run **once** after FastAPI prod is deployed and connected to prod DB. Uses stamp only — **no DDL**.

```bash
# Railway CLI or one-off shell on ontrack-back-fastapi
cd backend
export DATABASE_URL='...'   # production — only after MIG-015 rehearsal signed off

uv run python scripts/validate_schema.py
./scripts/db_rehearsal_stamp.sh
```

Expected:

- `Schema parity OK (empty diff).`
- `alembic current` → `7966d120d748 (head)`
- Row counts unchanged

If schema drift: **stop** — do not stamp. Investigate per [DATABASE_COMPATIBILITY.md](./DATABASE_COMPATIBILITY.md).

---

## Step 3 — Smoke FastAPI (before switching frontend)

```bash
export API_URL=https://<fastapi-prod-domain>
chmod +x backend/scripts/cutover_smoke.sh
./backend/scripts/cutover_smoke.sh
```

Manual checks (use existing prod user):

- [ ] Login with email/password
- [ ] Google OAuth full flow (update redirect URI in Google Console first)
- [ ] `GET /api/members/` with token
- [ ] Product CRUD
- [ ] Meal plan list/summary
- [ ] Frontend pointed at FastAPI **locally** (`REACT_APP_API_URL=<fastapi-url>`) — quick UI pass

Full list: [CUTOVER_AND_ROLLBACK.md](./CUTOVER_AND_ROLLBACK.md#smoke-tests-cutover-gate).

---

## Step 4 — Switch frontend to FastAPI

On Railway service **`ontrackapp`**:

1. **Variables** → set build-time:
   ```
   REACT_APP_API_URL=https://<fastapi-prod-domain>
   ```
2. **Redeploy** frontend (rebuild required — CRA bakes URL at build time)
3. Verify in browser: network tab shows API calls to FastAPI domain

**Do not** change frontend React code in this step — env var only.

---

## Step 5 — Flask standby

On Railway service **`ontrack-back`** (Flask):

1. **Do not delete** the service
2. Options:
   - **Scale to 0** replicas (preferred — instant rollback)
   - Or leave running idle (costs resources)
3. Keep `DATABASE_URL` and secrets unchanged for rollback

---

## Step 6 — Post-cutover monitoring (24–72h)

| Signal | Action |
|--------|--------|
| Railway logs 5xx | Check FastAPI service; consider rollback |
| 401 spike | Verify `JWT_SECRET_KEY` matches pre-cutover |
| OAuth failures | `GOOGLE_REDIRECT_URI` + Google Console |
| DB connections | Railway Postgres metrics |

---

## Rollback (< 5 min)

If critical issues after frontend switch:

1. **`ontrackapp`** → set `REACT_APP_API_URL` back to Flask URL (`https://<ontrack-back-domain>`)
2. Redeploy frontend
3. Scale **`ontrack-back-fastapi`** to 0
4. Scale **`ontrack-back`** (Flask) back up if scaled down
5. Verify login + CRUD on Flask

Database unchanged if cutover used stamp-only (no `alembic upgrade` DDL).

Details: [CUTOVER_AND_ROLLBACK.md](./CUTOVER_AND_ROLLBACK.md#rollback-procedure).

---

## Google OAuth cutover

| Item | Flask (before) | FastAPI (after) |
|------|----------------|-----------------|
| Redirect URI | `https://ontrack-back.../api/auth/google/callback` | `https://ontrack-back-fastapi.../api/auth/google/callback` |
| Console | Keep both URIs during transition | Add FastAPI URI before cutover |

FastAPI uses `GOOGLE_REDIRECT_URI` env var (not dynamic from request).

---

## Local development (unchanged)

```bash
docker compose up
# Flask :5001 (default) or FastAPI :8000 — see .env.example
```

Production cutover does not change local compose defaults until MIG-017.

---

## Cutover gate sign-off

| Check | Owner | Date |
|-------|-------|------|
| Staging rehearsal (MIG-015) | | |
| Prod stamp + schema parity | | |
| Automated smoke (`cutover_smoke.sh`) | | |
| Manual auth + CRUD smoke | | |
| Frontend `REACT_APP_API_URL` updated | | |
| Flask standby confirmed | | |

---

## Related docs

- [RAILWAY_STAGING.md](./RAILWAY_STAGING.md) — staging deploy
- [DB_REHEARSAL.md](./DB_REHEARSAL.md) — stamp rehearsal
- [CUTOVER_AND_ROLLBACK.md](./CUTOVER_AND_ROLLBACK.md) — phases + rollback
- [.github/DEPLOY.md](../../.github/DEPLOY.md) — CI + Railway workflow
