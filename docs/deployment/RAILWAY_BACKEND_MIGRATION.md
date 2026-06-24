# Railway backend migration — Root Directory `/backend`

Migrate `ontrack-back` from **repo-root** build context to **self-contained `backend/`**
image (DATA-004+). Do not delete root `railway.toml` until the new deploy is verified.

---

## Current state (before UI change)

| Setting | Value |
|---------|-------|
| Service | `ontrack-back` |
| Root Directory | *(empty — repo root)* |
| Config file | `/railway.toml` (auto-detect) |
| Dockerfile | `backend/Dockerfile.railway` (**removed** — deploy broken until migration) |
| Build context | Monorepo root (legacy) |

## Target state (after UI change)

| Setting | Value |
|---------|-------|
| Service | `ontrack-back` |
| Root Directory | `backend` |
| Config file path | `railway.toml` (resolves to `backend/railway.toml`) |
| Dockerfile | `Dockerfile` (inside `backend/`) |
| Build context | `backend/` only |
| Start command | *(empty — image CMD `scripts/start-production.sh`)* |
| Healthcheck | `/health`, timeout 120s |

Worker (if deployed): same Root Directory `backend`, config `railway.worker.prod.toml`,
start command `sh scripts/start-worker.sh`.

---

## Pre-flight

- [ ] DATA-004 merged (`docker build backend` passes locally)
- [ ] CI green on `main`
- [ ] Copy all **Variables** from current `ontrack-back` (see below)
- [ ] Note current public URL for smoke tests

### Required variables (do not lose)

| Variable | Example / note |
|----------|----------------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `JWT_SECRET_KEY` | same as today |
| `FLASK_SECRET_KEY` | same as today |
| `FRONTEND_URL` | `https://<ontrackapp-domain>` |
| `GOOGLE_CLIENT_ID` | OAuth |
| `GOOGLE_CLIENT_SECRET` | OAuth |
| `GOOGLE_REDIRECT_URI` | `https://<api-domain>/api/auth/google/callback` |
| `GEMINI_API_KEY` | optional features |
| `PEXELS_API_KEY` | optional |
| `DEEPSEEK_API_KEY` | optional |
| `REDIS_URL` | if worker enabled |

`RUNTIME_DATA_DIR` is **not** required — default is `backend/data/` inside the image.

---

## Migration steps (Railway UI)

1. Open project → service **`ontrack-back`** → **Settings** → **Source**.
2. Set **Root Directory** to: `backend`
3. Set **Config File Path** to: `railway.toml`  
   (or `backend/railway.toml` if Railway requires full path from repo root)
4. Confirm **Branch** = `main`, **Wait for CI** = ON.
5. **Do not** set a custom start command (image CMD is correct).
6. Trigger **Deploy** (or push empty commit after merge).
7. Watch **Build logs** — must show `COPY data ./data` and no `scraper/` paths.
8. Watch **Deploy logs** — `=== OnTrack FastAPI backend starting ===`

---

## Verification

```bash
# Health
curl -sf "https://<ontrack-back-domain>/health"

# Public dish compare (demo dataset)
curl -sf "https://<ontrack-back-domain>/api/public/dish-compare?lang=pl" | jq '.currency, (.dishes | length)'

# Optional: run from repo
API_URL=https://<ontrack-back-domain> ./backend/scripts/cutover_smoke.sh
```

Inside container (Railway shell):

```bash
uv run python scripts/validate_runtime_data.py
```

Expected: `OK: backend/data runtime dataset validated`

---

## Rollback

If build or runtime fails:

1. **Settings** → **Source** → clear **Root Directory** (repo root).
2. Restore **Config file path** to `/railway.toml`.
3. Temporarily restore legacy deploy by reverting DATA-004 on `main` **or** cherry-pick
   `backend/Dockerfile.railway` from git history until fixed.
4. Redeploy and confirm `GET /health`.

Keep root `/railway.toml` in the repo until rollback is no longer needed (DATA-006).

---

## Frontend

`ontrackapp` is unchanged: Root Directory `frontend`, config `frontend/railway.toml`.

Ensure `REACT_APP_API_URL` still points at the **same** `ontrack-back` public URL.

---

## After successful migration

Confirm deploy is green, then proceed with **DATA-006** (`chore/remove-legacy-deployment-config`)
to remove root `railway.toml` and duplicate configs.
