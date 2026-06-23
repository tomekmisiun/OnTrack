# OnTrack FastAPI backend

Target replacement for the legacy Flask app in `app/`. Built incrementally per
[`docs/backend-migration/MIGRATION_ROADMAP.md`](../docs/backend-migration/MIGRATION_ROADMAP.md).

## Current scope (MIG-001 + MIG-003)

- FastAPI app with `GET /health` → `{ "status": "ok" }`
- SQLAlchemy models for all 10 OnTrack tables
- OnTrack-only Alembic chain under `alembic/` (no foundation migrations)

## Local development

```bash
cd backend
uv sync
uv run pytest -q
uv run ruff check .
uv run uvicorn app.main:app --reload --port 8000
curl -s http://localhost:8000/health
```

### Database migrations

```bash
# Requires Postgres — use compose db or TEST_DATABASE_URL
export DATABASE_URL=postgresql+psycopg://user:change-me@localhost:5432/mealplanner
uv run alembic upgrade head
uv run alembic current
```

Integration test (fresh schema):

```bash
export TEST_DATABASE_URL=postgresql+psycopg://user:change-me@localhost:5432/ontrack_mig_test
uv run pytest tests/integration/test_migrations_fresh.py -v
```

## Docker

From repo root (with compose):

```bash
# Default: Flask :5001, FastAPI :8000
docker compose up --build backend

# FastAPI on :5001 (roadmap validate)
FLASK_PUBLISH_PORT=5002 BACKEND_PUBLISH_PORT=5001 docker compose up --build -d app backend
curl -sf http://localhost:5001/health
```

Image runs uvicorn on port **8000** inside the container.

## Python version

3.11 — aligned with OnTrack CI and the legacy Flask Dockerfile.
