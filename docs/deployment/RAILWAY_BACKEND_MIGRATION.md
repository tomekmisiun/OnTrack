# Railway backend deployment

**Status:** ✅ migrated (DATA-006 complete).

Production service **`ontrack-back`**:

| Setting | Value |
|---------|-------|
| Root Directory | `backend` |
| Config file path | `/backend/railway.toml` |
| Dockerfile | `Dockerfile` |
| Build context | `backend/` only |
| Healthcheck | `/health` |

See also: [`.github/DEPLOY.md`](../../.github/DEPLOY.md). CI deploys **`ontrack-back`** and **`ontrackapp`** only (no worker service).

---

## Emergency rollback

1. Railway → `ontrack-back` → Root Directory: *(empty — repo root)*
2. Restore from git history before DATA-006:
   - `/railway.toml`
   - `backend/Dockerfile.railway` (before DATA-004)
3. Redeploy and verify `GET /health`

---

## Archive — initial migration (DATA-005)

The steps below were used for the one-time migration from repo-root build context.

### Before migration

| Setting | Value |
|---------|-------|
| Root Directory | *(empty — repo root)* |
| Config | `/railway.toml` |
| Dockerfile | `backend/Dockerfile.railway` (removed in DATA-004) |

### Migration steps (completed)

1. Settings → Source → Root Directory: `backend`
2. Config file path: `/backend/railway.toml`
3. Wait for CI: ON
4. Deploy → verify build logs show `COPY data ./data`
5. `curl -sf https://<domain>/health`

### Required variables

| Variable | Note |
|----------|------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `JWT_SECRET_KEY` | unchanged |
| `FLASK_SECRET_KEY` | unchanged |
| `FRONTEND_URL` | ontrackapp URL |
| Google OAuth + API keys | copy from prior service |

`RUNTIME_DATA_DIR` not required — defaults to `backend/data/` in image.

### Database migrations (pre-deploy)

`backend/railway.toml` sets:

```toml
[deploy]
preDeployCommand = "sh scripts/run-migrations.sh"
```

Railway runs this **once per deployment** in a pre-deploy container (before the new API instance starts). If the command exits non-zero, the deployment is aborted. The script is included in the production Docker image (`COPY alembic`, `COPY scripts`).

Confirm in Dashboard → `ontrack-back` → latest deployment → **Pre-deploy** phase logs show `Alembic current: f1a2b3c4d5e6 (head)`.

Post-deploy auth smoke: [`RAILWAY_AUTH_PRODUCTION_VERIFY.md`](./RAILWAY_AUTH_PRODUCTION_VERIFY.md)

### Verification commands

```bash
curl -sf "https://<ontrack-back-domain>/health"
curl -sf "https://<ontrack-back-domain>/api/public/dish-compare?lang=pl"
API_URL=https://<ontrack-back-domain> ./backend/scripts/cutover_smoke.sh
```

Container:

```bash
uv run python scripts/validate_runtime_data.py
```

### Frontend

`ontrackapp`: Root Directory `frontend-next`, `NEXT_PUBLIC_API_URL` → `ontrack-back` URL (build-time).
