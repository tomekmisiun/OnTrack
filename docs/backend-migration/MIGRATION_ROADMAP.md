# Migration roadmap

One task = one branch = one reviewable PR. Flask remains until MIG-016 stability period completes.

---

## MIG-000 — Contract and migration documentation

| Field | Value |
|-------|-------|
| **Branch** | `mig-000-migration-docs` |
| **Goal** | Discovery + plan documents in `docs/backend-migration/` |
| **Scope** | Documentation only |
| **Dependencies** | None |
| **Acceptance** | All files in README index; no code changes outside docs |
| **Tests** | N/A |
| **Validate** | Peer review of API_CONTRACT vs `frontend/src/api.js` |
| **Rollback** | Delete docs folder |
| **Out of scope** | Implementation, compose changes, template copy |

**Status:** ✅ Complete — merged in PR #7 (`docs/mig-000-backend-migration`).

---

## MIG-001 — FastAPI backend skeleton and trimmed foundation

| Field | Value |
|-------|-------|
| **Branch** | `mig-001-fastapi-skeleton` |
| **Goal** | Add `backend/` with minimal FastAPI app from trimmed foundation patterns |
| **Files** | `backend/pyproject.toml`, `backend/app/main.py`, `backend/app/core/config.py`, `backend/Dockerfile`, `backend/README.md`, `backend/tests/test_health.py` |
| **Dependencies** | MIG-000 |
| **Acceptance** | `backend` imports; `GET /health` returns `{status:ok}`; ruff passes; no domain routes |
| **Tests** | `backend/tests/test_health.py` |
| **Validate** | `cd backend && uv run pytest -q` |
| **Rollback** | Remove `backend/` directory |
| **Out of scope** | Domain routes, Alembic, Redis, worker, compose, Flask edits, frontend |

**Status:** ✅ Complete — `backend/` skeleton, `GET /health`, pytest + ruff.

---

## MIG-002 — Local Compose integration

| Field | Value |
|-------|-------|
| **Branch** | `mig-002-compose-integration` |
| **Goal** | Wire `backend` service; map `5001:8000`; keep Flask on alternate port |
| **Files** | `docker-compose.yml`, `.env.example` comments |
| **Dependencies** | MIG-001 |
| **Acceptance** | `docker compose up` starts frontend + flask + fastapi; curl `:5001/health` hits FastAPI when selected |
| **Tests** | Compose smoke script or documented curl |
| **Validate** | `docker compose up -d && curl -sf localhost:5001/health` |
| **Rollback** | Revert compose changes |
| **Out of scope** | Switching frontend default to FastAPI for all routes |

**Status:** ✅ Complete — `backend` service in compose; port switch via `FLASK_PUBLISH_PORT` / `BACKEND_PUBLISH_PORT`.

---

## MIG-003 — Database models and safe Alembic baseline

| Field | Value |
|-------|-------|
| **Branch** | `mig-003-db-baseline` |
| **Goal** | SQLAlchemy models + OnTrack-only Alembic initial revision |
| **Files** | `backend/app/models/*`, `backend/alembic/*`, `backend/tests/integration/test_migrations_fresh.py` |
| **Dependencies** | MIG-001 |
| **Acceptance** | Fresh Postgres → `alembic upgrade head` creates OnTrack schema; **no** foundation tables |
| **Tests** | Migration test on empty DB |
| **Validate** | `alembic upgrade head` + table list assertion |
| **Rollback** | Drop staging DB; revert branch |
| **Out of scope** | Production stamp; data migration |

**Status:** ✅ Complete — models, Alembic initial revision, integration test.

---

## MIG-004 — Authentication compatibility layer

| Field | Value |
|-------|-------|
| **Branch** | `mig-004-auth-compat` |
| **Goal** | Port auth routes with `{token}` contract + werkzeug passwords + OAuth |
| **Files** | `backend/app/api/routes/auth.py`, `services/auth_service.py`, `core/security.py`, `core/passwords.py`, models for User/AuthCode |
| **Dependencies** | MIG-003 |
| **Acceptance** | Contract tests pass for A01–A08; Flask-issued JWT works on FastAPI |
| **Tests** | `backend/tests/contract/test_auth_contract.py` + port `test_local_auth`, `test_oauth` |
| **Validate** | `uv run pytest tests/contract/test_auth_contract.py -v` |
| **Rollback** | Feature flag route traffic to Flask |
| **Out of scope** | Refresh tokens; password reset |

**Status:** ✅ Complete — auth routes A01–A08, werkzeug passwords, `{ token }` contract, contract tests.

---

## MIG-005 — Members domain

| Branch | `mig-005-members` |
| Dependencies | MIG-004 |
| Acceptance | M01–M05 contract tests green |
| Tests | Port `test_members*.py` |

**Status:** ✅ Complete — M01–M05 routes and contract tests.

---

## MIG-006 — Products domain

| Branch | `mig-006-products` |
| Dependencies | MIG-004 |
| Acceptance | P01–P05 contract tests green |
| Tests | Port `test_products*.py` |

**Status:** ✅ Complete — P01–P05 routes and contract tests.

---

## MIG-007 — Recipes domain

| Branch | `mig-007-recipes` |
| Dependencies | MIG-006 |
| Acceptance | R01–R09 contract tests; create/update weight semantics |
| Tests | Port `test_recipes*.py` |

---

## MIG-008 — Meal-plan domain

| Branch | `mig-008-meal-plan` |
| Dependencies | MIG-005, MIG-007 |
| Acceptance | MP01–MP06 including summary math |
| Tests | Port `test_meal_plan*.py` |

---

## MIG-009 — Day-schedule domain

| Branch | `mig-009-day-schedule` |
| Dependencies | MIG-005 |
| Acceptance | DS01–DS06 including overlap 409 |
| Tests | Port `test_day_schedule.py` |

---

## MIG-010 — Nutrition and fuel

| Branch | `mig-010-nutrition-fuel` |
| Dependencies | MIG-006 |
| Acceptance | N01, F01 contract tests |
| Tests | Port `test_nutrition.py`, `test_fuel.py` |

---

## MIG-011 — Import and public endpoints

| Branch | `mig-011-import-public` |
| Dependencies | MIG-006, MIG-004 |
| Acceptance | I01–I03, PU01; dish-compare HTTP test |
| Tests | Port `test_import.py`, add `test_public_dish_compare_http.py` |

---

## MIG-012 — Worker migration

| Branch | `mig-012-worker` |
| Dependencies | MIG-004, MIG-002 (Redis) |
| Acceptance | Catalog seed runs via worker; no auth threads in FastAPI |
| Tests | Integration test job enqueue + process |
| Out of scope | DLQ, email jobs |

---

## MIG-013 — Contract regression suite

| Branch | `mig-013-contract-suite` |
| Dependencies | MIG-004 through MIG-011 |
| Acceptance | Single `pytest tests/contract/` covers all API_CONTRACT rows |
| CI | Add backend job; gradual coverage thresholds |
| Policy | New modules ≥ 80% coverage; global floor 50% initially (**ADAPT** ramp) |

---

## MIG-014 — Railway staging deployment

| Branch | `mig-014-railway-staging` |
| Dependencies | MIG-013 |
| Acceptance | FastAPI staging service on Railway; **clone DB** attached |
| Out of scope | Production traffic switch |

---

## MIG-015 — Production database adoption rehearsal

| Branch | `mig-015-db-rehearsal` |
| Dependencies | MIG-014 |
| Acceptance | Documented runbook executed on staging clone; `alembic stamp` validated |
| Tests | Schema diff empty; smoke checklist |

---

## MIG-016 — Production cutover

| Branch | `mig-016-production-cutover` |
| Dependencies | MIG-015 |
| Acceptance | Frontend `REACT_APP_API_URL` points to FastAPI prod; Flask standby |
| Rollback | See CUTOVER_AND_ROLLBACK.md |

---

## MIG-017 — Flask backend removal

| Branch | `mig-017-remove-flask` |
| Dependencies | MIG-016 + stability period (suggest 14 days) |
| Acceptance | Remove `app/`, `run.py`, Flask Dockerfile service, `migrations/` from deploy path |
| Out of scope | Scraper removal |

---

## Dependency graph

```text
MIG-000
  └─ MIG-001
       ├─ MIG-002
       └─ MIG-003
            └─ MIG-004
                 ├─ MIG-005 ─┬─ MIG-008
                 ├─ MIG-006 ─┼─ MIG-007 ─┘
                 │           ├─ MIG-010
                 │           └─ MIG-011
                 └─ MIG-009
                      └─ (MIG-012 after MIG-002)
                           └─ MIG-013
                                └─ MIG-014
                                     └─ MIG-015
                                          └─ MIG-016
                                               └─ MIG-017
```

---

## Branch naming convention

`mig-NNN-short-slug` — matches task ID.

---

## Per-PR checklist (all implementation tasks)

- [ ] Contract tests added/updated for touched endpoints
- [ ] No frontend file changes
- [ ] Flask still runs in compose (until MIG-017)
- [ ] Documentation updated if contract assumptions change
- [ ] Rollback noted in PR description
