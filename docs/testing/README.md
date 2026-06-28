# Testing guide

**Last verified:** 2026-06-27

How tests are organized, how to run them locally, and how CI jobs map to commands. Prefer the commands below over fixed test counts — counts change as the suite grows.

---

## Table of contents

- [Strategy](#strategy)
- [Test pyramid](#test-pyramid)
- [Quick commands](#quick-commands)
- [Backend tests](#backend-tests)
- [Frontend tests](#frontend-tests)
- [CI job matrix](#ci-job-matrix)
- [Post-deploy smoke](#post-deploy-smoke)
- [Coverage](#coverage)
- [OpenAPI contract drift](#openapi-contract-drift)
- [Choosing the right test level](#choosing-the-right-test-level)
- [Playwright decision](#playwright-decision)
- [Common problems](#common-problems)

---

## Strategy

OnTrack uses a simple test pyramid:

1. **Unit tests** — pure logic, helpers, route handlers (fast switch)
2. **Service / domain tests** — business rules with minimal mocking
3. **API contract tests** — FastAPI endpoints against SQLite in-memory DB
4. **Integration tests** — Postgres migrations and catalog rehearsal
5. **Frontend unit tests** — Vitest for helpers, hooks logic, BFF utilities
6. **Post-deploy HTTP smoke** — register/login against live staging/production URLs

Browser E2E (Playwright) was **removed** — see [Playwright decision](#playwright-decision).

---

## Test pyramid

| Level | Location | Framework | CI job |
|-------|----------|-----------|--------|
| Backend contract | `backend/tests/contract/` | pytest | `test` |
| Backend unit / policy | `backend/tests/test_*.py` | pytest | `test` (subset) + local full run |
| Backend integration | `backend/tests/integration/` | pytest + Postgres | `backend-integration` |
| Frontend unit | `frontend-next/tests/unit/` | Vitest | `frontend-next` |
| Docker build | Dockerfiles | docker build | `backend-docker`, `frontend-next-docker` |
| Deploy smoke | `backend/scripts/verify-production-auth.sh` | curl + jq | `staging-smoke`, `production-smoke` |

---

## Quick commands

| Target | Command |
|--------|---------|
| Backend CI subset | `make test` |
| Backend without Postgres | `make test-backend` |
| Backend integration (Postgres) | `make test-integration` (requires `TEST_DATABASE_URL`) |
| Frontend unit | `make test-frontend` |
| AI workflow validation | `make validate` |
| Frontend lint + types + build | `cd frontend-next && npm run lint && npm run typecheck && npm run build` |

### Full local validation before merge

```bash
make validate
make test
make test-backend
make test-frontend
cd backend && uv run ruff check .
cd frontend-next && npm run lint && npm run typecheck && npm run build
# Optional — requires Postgres + TEST_DATABASE_URL:
# make test-integration
```

---

## Backend tests

### CI subset (`make test`)

Runs the same pytest paths as the `test` CI job:

```bash
cd backend && uv run pytest tests/contract/ \
  tests/test_health.py tests/test_dish_compare_data.py tests/test_catalog_pipeline.py -q
```

Environment (CI uses these):

```bash
export TESTING=1
export DATABASE_URL=sqlite://
export FLASK_SECRET_KEY=ci-test-flask-secret-key-0123456789abcdef
export JWT_SECRET_KEY=ci-test-jwt-secret-key-0123456789abcdef
```

Also runs in CI: `ruff check`, `build_catalog --check`, `validate_runtime_data.py`, coverage ≥50%.

### Backend without Postgres (`make test-backend`)

Runs all backend pytest modules **except** `tests/integration/` — no external PostgreSQL required:

```bash
make test-backend
# equivalent: cd backend && uv run pytest --ignore=tests/integration -q
```

Includes contract tests, health, dish compare, catalog pipeline, and unit/policy tests not in the CI subset. Run before large backend refactors.

### Integration tests (Postgres)

```bash
export TEST_DATABASE_URL=postgresql+psycopg://ontrack:ontrack@localhost:5432/ontrack_rehearsal
make test-integration
```

Requires a running Postgres 15 instance. CI uses an ephemeral service container.

### Single test

```bash
cd backend && uv run pytest tests/contract/test_auth_contract.py::test_me_requires_auth -q
```

---

## Frontend tests

All frontend tests are Vitest unit tests in `frontend-next/tests/unit/`.

```bash
cd frontend-next && npm run test           # all suites
cd frontend-next && npm run test:watch    # watch mode
cd frontend-next && npm run test:recipes   # single-suite shortcut
```

The `frontend-next` CI job also runs `npm run lint`, `npm run typecheck`, and `npm run build` — production build is the integration check for the Next.js app.

### Single test

```bash
cd frontend-next && npx vitest run tests/unit/routes.test.ts
```

---

## CI job matrix

| Job | Trigger | Scope |
|-----|---------|-------|
| `test` | PR + `main` | ruff, catalog check, runtime data, pytest contract subset, OpenAPI drift, cov ≥50% |
| `frontend-next` | PR + `main` | generate:api, schema drift, vitest, lint, typecheck, build |
| `backend-docker` | PR + `main` | `docker build backend` |
| `frontend-next-docker` | PR + `main` | `docker build -f Dockerfile.railway frontend-next` |
| `backend-integration` | PR + `main` | `pytest tests/integration/` with Postgres service |
| `deploy-staging` | `main` push only | Railway deploy (staging) — after all CI jobs pass |
| `wait-staging-ready` | after staging deploy | Poll `/health/ready` |
| `staging-smoke` | after readiness | `verify-production-auth.sh` on staging |
| `deploy-production` | after staging smoke + approval | Railway deploy (production) |
| `production-smoke` | after production deploy | Readiness + auth smoke |

Optional (not PR gate): `.github/workflows/production-smoke.yml` (scheduled/manual).

---

## Post-deploy smoke

`backend/scripts/verify-production-auth.sh` performs HTTP register → login → `/api/auth/me` against live URLs. This replaces browser E2E for auth verification in deployed environments.

Required env vars: `API_URL`, `FRONTEND_ORIGIN`, optional `SMOKE_TARGET`.

---

## Coverage

Backend coverage runs in CI `test` job with `--cov-fail-under=50`. Generate locally:

```bash
cd backend && uv run pytest tests/contract/ tests/test_health.py -q --cov=app --cov-report=term-missing
```

Frontend has no coverage gate — Vitest runs without coverage collection.

---

## OpenAPI contract drift

After backend schema changes:

```bash
cd frontend-next
npm run export:openapi    # updates openapi/openapi.json
npm run generate:api      # updates lib/api/generated/schema.ts
```

CI fails if either file drifts from committed versions.

---

## Choosing the right test level

| Change | Required test |
|--------|---------------|
| Service / domain logic | pytest unit or service test |
| API endpoint | contract test in `backend/tests/contract/` |
| DB migration | integration test in `backend/tests/integration/` |
| Frontend helper / hook logic | Vitest in `frontend-next/tests/unit/` |
| Next.js route handler | Vitest (mock `fetch`) |
| Protected route redirect | `middleware.test.ts` + `routes.test.ts` |
| Auth flow against live deploy | `verify-production-auth.sh` (staging/production smoke) |
| Purely visual UI change | Manual review or targeted component assertion — not full-page screenshots |

---

## Playwright decision

**Verdict: REMOVED** (2026-06-27)

Playwright and all browser E2E tests were removed after audit. Reasons:

| Former E2E scenario | Replacement |
|---------------------|-------------|
| Visual screenshot regression (36 PNG baselines) | Removed — flaky, not requested |
| Module smoke (8 routes, mocked API) | Backend contract tests + `npm run build` in CI |
| Core user flows (products/recipes/calendar, mocked) | Contract tests (`test_products_contract`, `test_recipes_contract`, `test_meal_plan_contract`) |
| Auth negative (wrong password UI) | `test_auth_contract.py` (401/400 API responses) |
| Auth full-stack (register → calendar → logout) | `test_auth_contract.py` + staging/production HTTP smoke |
| Meal persistence across reload | `test_meal_plan_contract.py` |
| Profile locale/market UI | `test_ui_locale_market.py` (11 API tests) + `locale-market.test.ts` |
| Dish compare fallback on login | `dish-compare-route.test.ts` (Next route handler) + `dish-compare-fallback.test.ts` |
| Login showcase / marketing DOM | No regression risk — removed |
| Protected route redirect | `middleware.test.ts` + `routes.test.ts` |

What we kept instead of browser tests:

- **116+ contract tests** exercising real FastAPI endpoints
- **Vitest** for frontend logic and Next.js route handlers
- **Production build** in CI (`npm run build`) catches Next.js compile/routing errors
- **HTTP auth smoke** on staging and production after deploy

### Accepted gap — login/register error UI

There is **no automated test** that renders login or registration error messages in a real browser (for example the `.login-error` element after a wrong password or duplicate email).

| What exists | What it covers |
|-------------|----------------|
| `test_auth_contract.py` | API returns 401/400 with correct error payloads |
| `verify-production-auth.sh` | Happy-path register → login → `/api/auth/me` on deployed URLs |
| Vitest | Middleware redirects, route config, route handlers — not React login form DOM |

Contract tests and deploy smoke are **not a full substitute** for browser E2E: they do not verify that the frontend maps API errors to visible UI copy, focus management, or layout around the error state.

This is a **conscious decision** after removing Playwright:

- Browser E2E had high CI cost (two jobs, browser install, production build per job) and duplicated API coverage for auth negatives.
- Current risk is judged **low**: auth error paths are simple; API contract tests guard the data layer; manual smoke on staging catches catastrophic auth breakage.
- Revisit with a **component test** (React Testing Library) if login/register UI grows more complex — not full-page Playwright.

---

## Common problems

| Symptom | Fix |
|---------|-----|
| `pytest` import errors | `cd backend && uv sync --dev` |
| Integration tests skip / fail | Set `TEST_DATABASE_URL` to a Postgres 15 database |
| OpenAPI drift CI failure | Run `npm run export:openapi && npm run generate:api` and commit |
| `make test-integration` connection refused | Start Postgres or use `docker compose up postgres` |
| Frontend tests fail after API change | Regenerate OpenAPI types; update affected unit tests |

---

## Related

- [development/README.md](../development/README.md) — local setup
- [operations/deployment.md](../operations/deployment.md) — deploy after CI
- `.github/DEPLOY.md` — operator quick reference
