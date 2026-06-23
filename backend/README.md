# OnTrack FastAPI backend

Target replacement for the legacy Flask app in `app/`. Built incrementally per
[`docs/backend-migration/MIGRATION_ROADMAP.md`](../docs/backend-migration/MIGRATION_ROADMAP.md).

## MIG-001 scope

- Minimal FastAPI application
- `GET /health` → `{ "status": "ok" }` (Flask parity)
- No domain routes, database, or worker yet

## Local development

```bash
cd backend
uv sync
uv run pytest -q
uv run ruff check .
uv run uvicorn app.main:app --reload --port 8000
curl -s http://localhost:8000/health
```

## Docker

Built from this directory in MIG-002 (compose integration). Image runs uvicorn on port **8000**.

## Python version

3.11 — aligned with OnTrack CI and the legacy Flask Dockerfile.
