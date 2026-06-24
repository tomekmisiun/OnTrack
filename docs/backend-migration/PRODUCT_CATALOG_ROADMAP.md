# Product catalog architecture roadmap

One task = one branch = one reviewable PR. **Stop after each task** for user approval
before starting the next.

**Goal:** Replace per-user catalog copies with a shared system catalog plus private
user products, without data loss, IDOR regressions, or mandatory Redis worker for seeding.

**Prerequisite:** DATA-001–006 complete ([DATA_DEPLOYMENT_ROADMAP.md](./DATA_DEPLOYMENT_ROADMAP.md));
backend runtime data lives in `backend/data/`.

**Audit baseline:** Read-only architecture audit (2026-05-26) — per-user seed copy model,
no global `products` table, worker redundant for catalog seed.

---

## Problem (current state)

| Issue | Detail |
|-------|--------|
| No global catalog | Every `products` row has mandatory `user_id` |
| Per-user seed copy | Registration inserts full `backend/data/seeds/` into each user |
| Redundant worker | `ensure_user_seeded` sync + `catalog_seed` job duplicate work |
| List performance | `GET /api/products/` uses `.all()`, partial Python filter, no pagination |
| Weak seed idempotency | `_seed_products` has no per-row key; guard is `price > 0` only |
| No system/private distinction | `_is_catalog_product()` heuristic only |

**Security today:** `user_id` isolation works in tested paths; no confirmed IDOR on
PUT/DELETE/recipe. This roadmap must preserve that.

---

## Target end state

Single `products` table with two record kinds:

**System product**

- `user_id IS NULL`
- Visible to all users for matching `lang`
- Stable `catalog_key` (not database ID)
- `source = system`
- Not editable/deletable by regular users

**Private product**

- `user_id = current_user.id`
- Visible only to owner
- `source = user | import | legacy`
- Optional `base_product_id` → system product (override / copy-on-write)

**User list query**

```text
system products for lang
UNION
own private products for user_id + lang
(minus global rows shadowed by private override via base_product_id)
```

**Seeding**

- Global catalog import: **once per environment**, idempotent UPSERT by `catalog_key`
- **Not** on register, login, `/me`, language change, or worker
- Demo dataset stays `dataset_type: demo` in `manifest.json` until explicitly verified

**Registration**

- No private copies of system catalog
- User sees system products via query layer
- Default recipes may remain per-user until a separate decision (Task 6)

### Target columns (conceptual)

```text
products
--------
id
user_id              nullable
source               system | user | import | legacy
catalog_key          nullable
base_product_id      nullable
normalized_name
name
lang
price
package_weight
unit
sold_by_weight
kcal, protein, fat, carbs
```

---

## Principles

| Principle | Detail |
|-----------|--------|
| One task per branch | No combined schema + import + auth + frontend changes |
| Preserve user data | No mass delete; legacy rows backfilled, not dropped |
| Deterministic backfill | No name-only matching when other fields exist |
| Idempotent operations | Re-run import / link without duplicates |
| No auto-curated demo | `manifest.json` honesty preserved |
| Tests first | Task 1 safety net before schema changes |
| User approval | No commit/push/merge without explicit approval per task |

---

## CAT-001 — Safety-net tests

| Field | Value |
|-------|-------|
| **Branch** | `test/product-catalog-safety-net` |
| **Goal** | Regression tests for isolation, seed behavior, FK delete, worker redundancy |
| **Dependencies** | None |
| **Files** | `backend/tests/contract/test_product_catalog_safety_net.py`, `backend/tests/integration/test_product_catalog_postgres.py`, `backend/pyproject.toml` (marker) |
| **Acceptance** | PUT/DELETE cross-user; recipe IDOR; legacy register copy documented (`@legacy_catalog_copy`); seed idempotency xfail; FK delete on Postgres; no schema/API/seed changes |
| **Tests** | New safety-net module; full `uv run pytest -q` |
| **Validate** | `cd backend && uv run pytest -q`; `uv run ruff check .`; `git diff --check` |
| **Rollback** | Delete new test files; revert marker in `pyproject.toml` |
| **Out of scope** | Models, migrations, services, production behavior |

**Status:** ✅ Complete — commit on `test/product-catalog-safety-net` (pending merge).

---

## CAT-002 — Global product schema

| Field | Value |
|-------|-------|
| **Branch** | `feat/global-product-catalog-schema` |
| **Goal** | Alembic migration + model for system/private products; backfill legacy rows |
| **Dependencies** | CAT-001 merged |
| **Files** | `backend/app/models/product.py`, new Alembic revision, Pydantic schemas, migration tests |
| **Acceptance** | `user_id` nullable; `source`, `catalog_key`, `base_product_id`, `normalized_name`; indexes `(user_id, lang)`, `(lang, normalized_name)`, unique `(lang, catalog_key)` for system rows; existing rows kept as `legacy`; no global import; no register/seed/list changes |
| **Tests** | Migration upgrade/downgrade; constraint tests |
| **Validate** | `uv run pytest -q`; test DB upgrade + downgrade |
| **Rollback** | `alembic downgrade -1`; revert model |
| **Out of scope** | Global seed import; remove per-user seed; query layer; worker |

---

## CAT-003 — Global catalog import

| Field | Value |
|-------|-------|
| **Branch** | `feat/global-product-catalog-import` |
| **Goal** | Idempotent CLI import from `backend/data/seeds/` → system products |
| **Dependencies** | CAT-002 merged |
| **Files** | `app/scripts/seed_global_catalog.py` (or repo convention), `catalog_seed_service` split/refactor, tests |
| **Acceptance** | Stable `catalog_key`; UPSERT not duplicate; `user_id NULL`, `source=system`; not on register/login/me/worker/migration; deterministic legacy link via `base_product_id`; report counts (created/updated/linked/ambiguous) |
| **Tests** | Idempotency; legacy link; manifest demo status unchanged |
| **Validate** | CLI dry run on test DB; `uv run pytest -q` |
| **Rollback** | Delete system rows by `source=system` (scripted, reviewed) |
| **Out of scope** | Change register flow; list API; worker removal |

---

## CAT-004 — Query layer (list + search + pagination)

| Field | Value |
|-------|-------|
| **Branch** | `feat/product-catalog-query-layer` |
| **Goal** | `GET /api/products/` returns system + own; SQL filter/search/pagination |
| **Dependencies** | CAT-003 merged (system rows exist in test env) |
| **Files** | `product_service.py`, `products.py` route, schemas, `recipe_service` product resolution, `import_service` |
| **Acceptance** | `q`, `limit`, `offset`; default/max limit (e.g. 20/100); no `.all()` on full catalog; override precedence; API fields `source`, `is_system`, `is_editable`, `base_product_id`; create always private; import cannot mutate system rows |
| **Tests** | Global+own; pagination; search; override; recipe uses global; no cross-user |
| **Validate** | `uv run pytest -q` |
| **Rollback** | Revert service/route changes |
| **Out of scope** | Mutation policy (403 on system edit); remove per-user seed |

---

## CAT-005 — Mutation policy

| Field | Value |
|-------|-------|
| **Branch** | `feat/product-catalog-mutation-policy` |
| **Goal** | Protect system products; safe delete with recipes |
| **Dependencies** | CAT-004 merged |
| **Files** | `product_service.py`, routes, optional `POST .../customize`, migration if FK strategy needs it |
| **Acceptance** | System product: 403 on PUT/DELETE by user; private: owner only; copy-on-write via explicit customize endpoint (no silent global UPDATE); delete strategy chosen (409 block / soft delete / controlled cascade) with tests |
| **Tests** | Full authorization matrix |
| **Validate** | `uv run pytest -q`; Postgres integration for FK behavior |
| **Rollback** | Revert mutation changes |
| **Out of scope** | Remove register seed; frontend |

---

## CAT-006 — Remove per-user product seed

| Field | Value |
|-------|-------|
| **Branch** | `refactor/remove-per-user-product-seed` |
| **Goal** | Stop copying products on register/login/me/language change |
| **Dependencies** | CAT-005 merged; global catalog imported in test/staging env |
| **Files** | `auth_service.py`, `catalog_seed_service.py`, tests (replace `@legacy_catalog_copy`) |
| **Acceptance** | No product copy on register/OAuth/login/me/lang; new user has zero private seed copies, sees system catalog; split product vs recipe seed; default recipe ingredients may reference global products; remove legacy copy test → new “no private copies, global visible” test |
| **Tests** | Register without product copy; global catalog visible |
| **Validate** | `uv run pytest -q` |
| **Rollback** | Restore `ensure_user_seeded` product path (feature flag or revert) |
| **Out of scope** | Worker removal; frontend; globalize recipes |

---

## CAT-007 — Frontend

| Field | Value |
|-------|-------|
| **Branch** | `feat/product-catalog-frontend` |
| **Goal** | Pagination, search, system vs private UX |
| **Dependencies** | CAT-006 merged |
| **Files** | `frontend/src/api.js`, Products component(s), tests |
| **Acceptance** | No full-catalog fetch on screen load; system: no edit/delete, optional customize; private: edit/delete; loading/empty/search/403/409 states |
| **Tests** | Frontend unit tests for permissions + pagination |
| **Validate** | `cd frontend && npm test`; manual smoke |
| **Rollback** | Revert frontend PR |
| **Out of scope** | Backend schema; worker |

---

## CAT-008 — Remove catalog seed worker

| Field | Value |
|-------|-------|
| **Branch** | `chore/remove-catalog-seed-worker` |
| **Goal** | Remove redundant `catalog_seed` job if no other active jobs |
| **Dependencies** | CAT-007 merged |
| **Files** | `app/worker/`, `auth_service.py`, `railway.worker*.toml`, docs, docker-compose |
| **Acceptance** | Re-audit job types; remove enqueue/handler/inline fallback for catalog seed; remove worker entrypoint only if unused; remove Redis dep only if unused elsewhere; **do not** change Railway UI automatically |
| **Tests** | Update/remove worker seed tests |
| **Validate** | `uv run pytest -q`; compose smoke if worker service removed |
| **Rollback** | Restore worker config from git |
| **Out of scope** | Railway UI edits; unrelated job types |

---

## Explicitly out of scope (entire roadmap)

- Scraper fixes or re-integration
- New full production dataset generation
- Demo → curated relabelling without verification
- Globalizing recipes (separate decision)
- Redis catalog cache, Elasticsearch, microservices
- Per-user database
- Deployment architecture changes (`backend/Dockerfile`, Railway Root Directory)
- Production data deduplication / destructive cleanup (separate approved task)

---

## Data migration rules

1. Never delete user product rows without separate approval.
2. Do not assume existing rows are unmodified seeds.
3. Link legacy copies to system products only on deterministic full match.
4. Report record counts before any destructive operation.
5. Schema migration and data migration are separate steps with rollback plans.
6. Ambiguous legacy rows: report, do not auto-modify.

---

## Workflow per task

1. Read `AGENTS.md`, `.ai-rules/`, relevant `.cursor/rules/`
2. Confirm clean `git status` on `main` (or prior task merged)
3. Create branch from table above
4. Implement **only** that task's scope
5. Run targeted tests + full `uv run pytest -q`
6. Run `git diff --check`
7. Self-review; post task report (see template in implementation prompt)
8. **Wait for user approval** — no commit/push/merge without approval
9. Proceed to next task only after merge approval

---

## Per-PR checklist

- [ ] Scope limited to one CAT task
- [ ] Safety-net / regression tests updated
- [ ] `cd backend && uv run pytest -q` passes
- [ ] `git diff --check` passes
- [ ] Migration upgrade/downgrade tested (when schema changes)
- [ ] Postgres integration tests pass in CI (`backend-integration` job)
- [ ] No Railway UI changes (unless manual checkpoint in CAT-008)
- [ ] No push without user approval
- [ ] Rollback steps in PR description

---

## Task dependency graph

```text
CAT-001 (tests)
    ↓
CAT-002 (schema)
    ↓
CAT-003 (global import CLI)
    ↓
CAT-004 (query layer)
    ↓
CAT-005 (mutations)
    ↓
CAT-006 (remove per-user seed)
    ↓
CAT-007 (frontend)
    ↓
CAT-008 (worker cleanup)
```

---

## Related documents

| Document | Purpose |
|----------|---------|
| [DATA_DEPLOYMENT_ROADMAP.md](./DATA_DEPLOYMENT_ROADMAP.md) | Runtime data + deploy (DATA-001–006) |
| [MIGRATION_ROADMAP.md](./MIGRATION_ROADMAP.md) | Flask → FastAPI (MIG-000–017) |
| [backend/data/manifest.json](../../backend/data/manifest.json) | Dataset provenance and demo status |
| [backend/data/README.md](../../backend/data/README.md) | Runtime data layout |

---

## Status

| Task | Branch | Status |
|------|--------|--------|
| CAT-001 | `test/product-catalog-safety-net` | ✅ Complete |
| CAT-002 | `feat/global-product-catalog-schema` | 🟡 In progress |
| CAT-003 | `feat/global-product-catalog-import` | ⬜ Not started |
| CAT-004 | `feat/product-catalog-query-layer` | ⬜ Not started |
| CAT-005 | `feat/product-catalog-mutation-policy` | ⬜ Not started |
| CAT-006 | `refactor/remove-per-user-product-seed` | ⬜ Not started |
| CAT-007 | `feat/product-catalog-frontend` | ⬜ Not started |
| CAT-008 | `chore/remove-catalog-seed-worker` | ⬜ Not started |
