# OnTrack FastAPI backend

Production API for OnTrack. See [`docs/backend-migration/MIGRATION_ROADMAP.md`](../docs/backend-migration/MIGRATION_ROADMAP.md).

## Local development

```bash
cd backend
uv sync
uv run pytest -q
uv run uvicorn app.main:app --reload --port 8000
curl -s http://localhost:8000/health
```

### Database migrations

```bash
export DATABASE_URL=postgresql+psycopg://user:change-me@localhost:5432/mealplanner
uv run alembic upgrade head
uv run alembic current
```

## Docker (from repo root)

```bash
docker compose up --build backend
curl -sf http://localhost:5001/health
```

## Docker

Build and run the API from `backend/` (self-contained image including `data/`):

```bash
docker build -t ontrack-api backend
```

Railway staging/production configs live under `backend/railway*.toml` — see
[DATA_DEPLOYMENT_ROADMAP.md](../docs/backend-migration/DATA_DEPLOYMENT_ROADMAP.md).

### Railway

- Staging: `backend/railway.toml` — [RAILWAY_STAGING.md](../docs/backend-migration/RAILWAY_STAGING.md)
- Production: `backend/railway.prod.toml` — [PRODUCTION_CUTOVER.md](../docs/backend-migration/PRODUCTION_CUTOVER.md)

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
