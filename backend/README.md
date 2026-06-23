# OnTrack FastAPI backend

Target replacement for the legacy Flask app in `app/`. Built incrementally per
[`docs/backend-migration/MIGRATION_ROADMAP.md`](../docs/backend-migration/MIGRATION_ROADMAP.md).

## Current scope (MIG-001 – MIG-004)

- FastAPI app with `GET /health` → `{ "status": "ok" }`
- SQLAlchemy models + OnTrack-only Alembic chain
- Auth routes `/api/auth/*` (login, register, exchange, me, language, delete, Google OAuth)
- JWT compatible with Flask (`JWT_SECRET_KEY`, `{ "token" }`, werkzeug passwords)

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

### Railway staging (MIG-014)

Production/staging image uses monorepo context:

```bash
docker build -f backend/Dockerfile.railway -t ontrack-fastapi-railway .
```

Deploy runbook: [`docs/backend-migration/RAILWAY_STAGING.md`](../docs/backend-migration/RAILWAY_STAGING.md).

### DB adoption rehearsal (MIG-015)

On an existing Flask-migrated database (staging clone):

```bash
cd backend
export DATABASE_URL=postgresql+psycopg://...
uv run python scripts/validate_schema.py
./scripts/db_rehearsal_stamp.sh
```

Runbook: [`docs/backend-migration/DB_REHEARSAL.md`](../docs/backend-migration/DB_REHEARSAL.md).

### Production cutover (MIG-016)

Railway prod configs: `railway.prod.toml`, `railway.worker.prod.toml`.

```bash
export API_URL=https://<fastapi-prod-domain>
./scripts/cutover_smoke.sh
```

Runbook: [`docs/backend-migration/PRODUCTION_CUTOVER.md`](../docs/backend-migration/PRODUCTION_CUTOVER.md).

## Background worker (MIG-012)

Catalog seed jobs enqueue to Redis (`REDIS_URL`). Without Redis, jobs run synchronously in-process (no threads).

```bash
# Local with compose
docker compose up --build backend worker redis db

# Worker only (from backend/)
export DATABASE_URL=postgresql+psycopg://user:change-me@localhost:5432/mealplanner
export REDIS_URL=redis://localhost:6379/0
uv run python -m app.worker.run
```

Integration test (in-memory test queue):

```bash
uv run pytest tests/integration/test_worker_catalog_seed.py -v
```

Contract regression suite (all API_CONTRACT rows):

```bash
uv run pytest tests/contract/ -q --cov=app --cov-fail-under=50
```

## Python version

3.11 — aligned with OnTrack CI and the legacy Flask Dockerfile.
