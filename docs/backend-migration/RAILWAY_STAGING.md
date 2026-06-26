# Railway staging — FastAPI

> **Updated after DATA-006.** Staging uses the same self-contained backend image as production.

Deploy FastAPI to Railway **staging** with a **clone** of production Postgres.

---

## Services (recommended names)

| Railway service | Config file path | Root Directory |
|-----------------|------------------|----------------|
| `ontrack-back-staging` | `/backend/railway.toml` | `backend` |
| `ontrack-postgres-staging` | Postgres clone | — |

Worker and Redis staging services were removed — see [`docs/adr/0002-background-worker.md`](../adr/0002-background-worker.md).

---

## FastAPI API service

1. **New service** → connect GitHub repo
2. **Settings → Source**
   - Branch: `main`
   - **Root Directory:** `backend`
   - **Config file path:** `/backend/railway.toml`
3. **Wait for CI:** ON
4. **Variables:** same as production (see [`.github/DEPLOY.md`](../../.github/DEPLOY.md)) but `DATABASE_URL` → **staging clone only**

```bash
curl -sf "https://<staging-api-domain>/health"
```

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
