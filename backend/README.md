# OnTrack FastAPI backend

Production API for OnTrack. Full setup: [`docs/DEVELOPMENT.md`](../docs/DEVELOPMENT.md). Deploy: [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md). Catalog data: [`data/README.md`](data/README.md).

## Local development

```bash
cd backend
uv sync
uv run pytest -q
uv run uvicorn app.main:app --reload --port 5001
curl -s http://localhost:5001/health
```

Runtime data lives in `data/` (see `data/manifest.json`).

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

```bash
docker compose -f ../docker-compose.yml up --build backend db
curl -sf http://localhost:5001/health
```

## Railway

| Service | Root Directory | Config file path |
|---------|----------------|------------------|
| API (`ontrack-back`) | `backend` | `/backend/railway.toml` |

## Contract suite

```bash
uv run pytest tests/contract/ -q --cov=app --cov-fail-under=50
```

Python 3.14.
