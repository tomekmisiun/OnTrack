# Testing guide

How CI jobs map to local commands. The full backend suite is **~198 pytest tests**; CI runs subsets for speed.

## Quick local checks

| Target | Command | Approx. scope |
|--------|---------|---------------|
| Makefile default | `make test` | Contract subset + health + dish_compare (~subset) |
| Full backend | `cd backend && uv run pytest -q` | All pytest tests |
| Frontend unit | `cd frontend-next && npm run test` | Vitest (43 tests) |

## CI job matrix

| Job | Trigger | Working dir | Main commands | Test scope |
|-----|---------|-------------|---------------|------------|
| `test` | PR + `main` | `backend/` | ruff, build_catalog --check, validate_runtime_data, pytest subset, OpenAPI drift | `tests/contract/`, `test_health.py`, `test_dish_compare_data.py`, `test_catalog_pipeline.py`; cov ≥50% |
| `frontend-next` | PR + `main` | `frontend-next/` | generate:api, schema.ts drift, vitest, lint, typecheck, build | Frontend unit + build |
| `frontend-next-e2e` | PR + `main` | `frontend-next/` | Playwright smoke | UI smoke (mocked API) |
| `frontend-next-e2e-auth` | PR + `main` | both | FastAPI + Postgres + Playwright | Register/login full stack |
| `backend-docker` | PR + `main` | repo root | `docker build backend` | Image build only |
| `frontend-next-docker` | PR + `main` | repo root | `docker build -f Dockerfile.railway` | Image build only |
| `backend-integration` | PR + `main` | `backend/` | `pytest tests/integration/` | Postgres migration rehearsal |
| `deploy-production` | **`main` push only** | repo root | `railway up` ×2 | Deploy after all jobs green |

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

## Visual regression (optional)

```bash
cd frontend-next
npm run test:e2e:visual
```

Not part of required CI status checks.
