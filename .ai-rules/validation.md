# Validation Commands — OnTrack

Agents MUST use these commands — not commands from other projects.

## AI workflow static validation

| Purpose | Command |
|---------|---------|
| Validate AI rules files | `make validate` or `bash scripts/validate-ai-workflows.sh` |

## Flask backend (current production path)

| Purpose | Command |
|---------|---------|
| Full backend test suite | `pip install -r requirements.txt && pytest tests/ -v` |
| Targeted test file | `pytest tests/test_<area>.py -v` |
| CI-equivalent env | Set `DATABASE_URL=sqlite:///:memory:`, `FLASK_SECRET_KEY`, `JWT_SECRET_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (see `.github/workflows/ci.yml`) |

## Local full stack (Docker)

| Purpose | Command |
|---------|---------|
| Start all services | `docker compose up --build` |
| Health check | `curl -sf http://localhost:5001/health` and `curl -sf http://localhost:3000` |
| Logs | `docker compose logs -f app frontend` |

## FastAPI backend (when `backend/` exists)

| Purpose | Command |
|---------|---------|
| Backend tests | `cd backend && uv run pytest -q` |
| Lint | `cd backend && uv run ruff check .` |

Document additional commands here as `backend/` lands (MIG-001+).

## Frontend

| Purpose | Command |
|---------|---------|
| Unit tests (interactive) | `cd frontend && npm test` |
| Production build | `cd frontend && npm run build` |

Skip frontend validation unless the task touches `frontend/`.

## Policy / git

| Purpose | Rule |
|---------|------|
| Commits / push | Only after explicit user approval (`.ai-rules/git.md`) |
| PR to `main` | Required for production; CI `test` must pass |

## Stop conditions

Do not claim validation PASS unless the command exited 0.

Report SKIPPED when a command does not apply (e.g. docs-only edits, or FastAPI commands before `backend/` exists).
