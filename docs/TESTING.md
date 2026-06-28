# Testing guide

How CI jobs map to local commands. Prefer running the commands below rather than relying on fixed test counts — they change as the suite grows.

## Quick local checks

| Target | Command |
|--------|---------|
| Makefile default | `make test` |
| Full backend | `cd backend && uv run pytest -q` |
| Backend integration | `cd backend && TEST_DATABASE_URL=postgresql+psycopg://… uv run pytest tests/integration/ -v` |
| Frontend unit | `cd frontend-next && npm run test` |
| E2E smoke | `cd frontend-next && npm run test:e2e` |
| E2E auth (full stack) | CI job `frontend-next-e2e-auth` — needs Postgres + backend running |

## CI job matrix

| Job | Trigger | Working dir | Main commands | Scope |
|-----|---------|-------------|---------------|-------|
| `test` | PR + `main` | `backend/` | ruff, build_catalog --check, validate_runtime_data, pytest subset, OpenAPI drift | Contract tests, health, dish_compare, catalog pipeline; cov ≥50% |
| `frontend-next` | PR + `main` | `frontend-next/` | generate:api, schema.ts drift, vitest, lint, typecheck, build | Frontend unit + build |
| `frontend-next-e2e` | PR + `main` | `frontend-next/` | Playwright smoke | UI smoke (mocked API) |
| `frontend-next-e2e-auth` | PR + `main` | both | FastAPI + Postgres + Playwright | Register/login full stack |
| `backend-docker` | PR + `main` | repo root | `docker build backend` | Image build only |
| `frontend-next-docker` | PR + `main` | repo root | `docker build -f Dockerfile.railway` | Image build only |
| `backend-integration` | PR + `main` | `backend/` | `pytest tests/integration/` | Postgres migration rehearsal |
| `deploy-staging` | **`main` push only** | repo root | `railway up --environment staging` ×2 | After all CI jobs |
| `wait-staging-ready` | after staging deploy | — | poll `/health/ready` | Staging gate |
| `staging-smoke` | after readiness | — | `verify-production-auth.sh` | Staging gate |
| `deploy-production` | after staging smoke + approval | repo root | `railway up --environment production` ×2 | Requires GitHub Environment approval |
| `production-smoke` | after production deploy | — | readiness + auth smoke | Production verification |

## Not run in default CI `test` job

Run locally before large backend changes:

```bash
cd backend
TEST_DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/ontrack_test \
  uv run pytest tests/integration/ -v
uv run pytest tests/ -q
```

## OpenAPI / TypeScript contract

```bash
cd frontend-next
npm run export:openapi    # updates openapi/openapi.json
npm run generate:api      # updates lib/api/generated/schema.ts
```

CI checks drift on both files in the `test` and `frontend-next` jobs.

## Related

- [DEVELOPMENT.md](./DEVELOPMENT.md) — local setup
- [DEPLOYMENT.md](./DEPLOYMENT.md) — deploy after CI
- `.github/DEPLOY.md` — operator quick reference
