# OnTrack FastAPI backend

Production API for OnTrack. See [`docs/backend-migration/DATA_DEPLOYMENT_ROADMAP.md`](../docs/backend-migration/DATA_DEPLOYMENT_ROADMAP.md).

## Local development

```bash
cd backend
uv sync
uv run pytest -q
uv run uvicorn app.main:app --reload --port 8000
curl -s http://localhost:8000/health
```

Runtime data lives in `data/` (demo dataset — see `data/manifest.json`).

```bash
uv run python scripts/validate_runtime_data.py
```

### Database migrations

```bash
export DATABASE_URL=postgresql+psycopg://user:change-me@localhost:5432/mealplanner
uv run alembic upgrade head
uv run alembic current
```

## Docker

Self-contained image (build context = `backend/`):

```bash
docker build -t ontrack-api .
docker compose -f ../docker-compose.yml up --build backend
curl -sf http://localhost:5001/health
```

## Railway

| Service | Root Directory | Config file path |
|---------|----------------|------------------|
| API (`ontrack-back`) | `backend` | `/backend/railway.toml` |
| Worker | `backend` | `/backend/railway.worker.prod.toml` |

Deploy guide: [`docs/deployment/RAILWAY_BACKEND_MIGRATION.md`](../docs/deployment/RAILWAY_BACKEND_MIGRATION.md)

### DB adoption rehearsal

```bash
export DATABASE_URL=postgresql+psycopg://...
uv run python scripts/validate_schema.py
./scripts/db_rehearsal_stamp.sh
```

## Background worker

```bash
docker compose up --build backend worker redis db
# or: uv run python -m app.worker.run
```

## Contract suite

```bash
uv run pytest tests/contract/ -q --cov=app --cov-fail-under=50
```

Python 3.11.
