# Development

**Last verified:** 2026-06-27

---

## Prerequisites

- Docker and Docker Compose
- [uv](https://docs.astral.sh/uv/) (Python 3.14 for backend)
- Node.js 24 + npm (frontend; matches CI)

---

## Quick start (Docker Compose)

```bash
cp .env.example .env
# Edit .env — at minimum POSTGRES_*, FLASK_SECRET_KEY, JWT_SECRET_KEY

docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:5001 |
| API docs | http://localhost:5001/docs |
| Postgres | localhost:5432 |
| Grafana (optional) | http://localhost:3001 |
| Prometheus (optional) | http://localhost:9090 |

Frontend dev container mounts `frontend-next/` with hot reload. Backend runs production-style image on port 5001 (maps to container 8000).

---

## Local development without Compose

### Backend

```bash
cd backend
uv sync --dev
export DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/mealplanner
export FLASK_SECRET_KEY=dev-secret
export JWT_SECRET_KEY=dev-jwt-secret
export FRONTEND_URL=http://localhost:3000
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 5001
```

### Frontend

```bash
cd frontend-next
npm ci
export NEXT_PUBLIC_API_URL=http://localhost:5001
npm run dev
```

Open http://localhost:3000

---

## Environment variables

Copy `.env.example` → `.env`. Never commit `.env`.

| Variable | Service | Purpose |
|----------|---------|---------|
| `POSTGRES_*` | Compose / local DB | Database credentials |
| `DATABASE_URL` | Backend | Full connection string (Railway sets automatically) |
| `FLASK_SECRET_KEY` | Backend | OAuth session cookie signing |
| `JWT_SECRET_KEY` | Backend | JWT signing |
| `FRONTEND_URL` | Backend | CORS allowed origins (comma-separated) |
| `GOOGLE_*` | Backend | OAuth (optional) |
| `GEMINI_API_KEY`, `PEXELS_API_KEY`, `DEEPSEEK_API_KEY` | Backend | Optional integrations |
| `NEXT_PUBLIC_API_URL` | Frontend | Public API base URL (build-time on Railway) |
| `NEXT_PUBLIC_BFF_ENABLED` | Frontend | Set `1` to enable HttpOnly cookie BFF locally |
| `TEST_DATABASE_URL` | Tests | Postgres for integration tests |

Railway-specific notes: [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## Common commands

| Task | Command |
|------|---------|
| Backend CI subset | `make test` |
| Backend without Postgres | `make test-backend` |
| Backend integration (Postgres) | `make test-integration` — requires `TEST_DATABASE_URL`; see [TESTING.md](./TESTING.md) |
| Frontend unit tests | `make test-frontend` or `cd frontend-next && npm run test` |
| Lint frontend | `cd frontend-next && npm run lint` |
| Typecheck | `cd frontend-next && npm run typecheck` |
| Frontend build | `cd frontend-next && npm run build` |
| Regenerate OpenAPI | `cd frontend-next && npm run export:openapi` |
| Regenerate TS client | `cd frontend-next && npm run generate:api` |
| Catalog build check | `cd backend && uv run python -m app.scripts.build_catalog --check` |
| AI workflow validation | `make validate` |

---

## Database migrations

```bash
cd backend
uv run alembic upgrade head
uv run alembic current   # should show d3e4f5a6b7c8 (head) at time of writing
```

Create new migration after model changes:

```bash
uv run alembic revision --autogenerate -m "description"
```

Rehearsal against disposable DB: [backend-migration/DB_REHEARSAL.md](./backend-migration/DB_REHEARSAL.md)

---

## Project layout

```
OnTrack/
├── backend/           FastAPI app, Alembic, data/, tests/
├── frontend-next/     Next.js production frontend
├── docs/              Human documentation
├── .ai-rules/         Agent binding rules (do not duplicate here)
├── archive/           Historical snapshots (not deployed)
├── monitoring/        Prometheus config (local)
├── docker-compose.yml
└── .github/workflows/ CI/CD
```

Component READMEs (`backend/README.md`, `frontend-next/README.md`) point here for full setup.

---

## Archive reference

| Path | Use |
|------|-----|
| `archive/frontend-cra-reference/` | Pre–Next.js UI snapshot — **not deployed** |
| `archive/scraper-legacy/` | Old fuel scraper — superseded by backend services |

---

## Agent / AI workflow

For automated agents working in this repo:

- Start with `.ai-rules/agent-orchestration.md` and `.ai-rules/context-map.md`
- Entry indexes: `AGENTS.md`, `CLAUDE.md`
- Workflow: [ai-workflows.md](./ai-workflows.md)

Do not treat `archive/` or old audit files as current state — use [CURRENT_STATE.md](./CURRENT_STATE.md).
