# Validation Commands — OnTrack

Agents MUST use these commands — not commands from other projects.

## AI workflow static validation

| Purpose | Command |
|---------|---------|
| Validate AI rules files | `make validate` or `bash scripts/validate-ai-workflows.sh` |

## FastAPI backend

| Purpose | Command |
|---------|---------|
| Contract + health tests | `cd backend && uv sync --dev && uv run pytest tests/contract/ tests/test_health.py -q` |
| Full backend suite | `cd backend && uv run pytest -q` |
| Lint | `cd backend && uv run ruff check .` |
| CI-equivalent env | `TESTING=1`, `DATABASE_URL=sqlite://`, `FLASK_SECRET_KEY`, `JWT_SECRET_KEY` (see `.github/workflows/ci.yml`) |

## Local full stack (Docker)

| Purpose | Command |
|---------|---------|
| Start all services | `docker compose up --build` |
| Health check | `curl -sf http://localhost:5001/health` and `curl -sf http://localhost:3000` |
| Logs | `docker compose logs -f backend frontend` |

## Frontend

| Purpose | Command |
|---------|---------|
| Unit tests | `cd frontend-next && npm run test` |
| E2E smoke | `cd frontend-next && npm run test:e2e` |
| Production build | `cd frontend-next && npm run build` |
| Lint + typecheck | `cd frontend-next && npm run lint && npm run typecheck` |

Skip frontend validation unless the task touches `frontend-next/`.

## Policy / git

| Purpose | Rule |
|---------|------|
| Commits / push | Only after explicit user approval (`.ai-rules/git.md`) |
| PR to `main` | Required for production; CI `test` must pass |

## Stop conditions

Do not claim validation PASS unless the command exited 0.

Report SKIPPED when a command does not apply (e.g. docs-only edits).
