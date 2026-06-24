# Railway staging — FastAPI

> **Updated after DATA-006.** Staging uses the same self-contained backend image as production.

Deploy FastAPI to Railway **staging** with a **clone** of production Postgres.

---

## Services (recommended names)

| Railway service | Config file | Root Directory |
|-----------------|-------------|----------------|
| `ontrack-back-staging` | `backend/railway.toml` | `backend` |
| `ontrack-worker-staging` | `backend/railway.worker.toml` | `backend` |
| `ontrack-redis-staging` | Railway Redis plugin | — |
| `ontrack-postgres-staging` | Postgres clone | — |

---

## FastAPI API service

1. **New service** → connect GitHub repo
2. **Settings → Source**
   - Branch: `main`
   - **Root Directory:** `backend`
   - **Config file path:** `railway.toml`
3. **Wait for CI:** ON
4. **Variables:** same as production (see [`.github/DEPLOY.md`](../../.github/DEPLOY.md)) but `DATABASE_URL` → **staging clone only**

```bash
curl -sf "https://<staging-api-domain>/health"
```

---

## Worker service

1. Same repo, **Root Directory:** `backend`
2. **Config:** `railway.worker.toml`
3. **Variables:** `DATABASE_URL`, `REDIS_URL`, secrets (same as API)

---

## Image layout

```bash
docker build -t ontrack-api backend
```

Runtime data is baked from `backend/data/` (see `data/manifest.json`). No monorepo `COPY` from `app/` or `scraper/`.

---

## Migrations

Runbook: **[DB_REHEARSAL.md](./DB_REHEARSAL.md)**

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Build fails `COPY` outside backend | Root Directory must be `backend`, not repo root |
| Health check timeout | Check `DATABASE_URL` and secrets |
| Dish compare empty | Run `uv run python scripts/validate_runtime_data.py` locally |
| OAuth redirect mismatch | Update Google Console + `GOOGLE_REDIRECT_URI` |

Production deploy: [`docs/deployment/RAILWAY_BACKEND_MIGRATION.md`](../deployment/RAILWAY_BACKEND_MIGRATION.md)
