# Data & deployment roadmap

One task = one branch = one reviewable PR. Do **not** combine build-context changes,
data moves, Dockerfile rewrites, scraper disconnect, and Railway cleanup in a single PR.

**Goal:** Backend becomes a self-contained runtime and deployment unit. Scraper stays in
the monorepo as **experimental / disconnected** — not part of the API image or Railway deploy.

**Prerequisite:** MIG-000–MIG-017 complete ([MIGRATION_ROADMAP.md](./MIGRATION_ROADMAP.md)).

---

## Target end state

```text
backend/
├── app/
├── data/              # sole runtime data source (manifest + approved datasets)
├── scripts/
├── tests/
├── Dockerfile         # build context = backend/
├── railway.toml       # Railway Root Directory = /backend
├── pyproject.toml
└── uv.lock

scraper/               # experimental; outputs NOT auto-published to backend/data
frontend/              # separate Railway service (unchanged in this roadmap)
```

| Principle | Detail |
|-----------|--------|
| No scraper at runtime | Backend must not import or read `scraper/` paths |
| No monorepo build context | `docker build backend/` copies only `backend/` |
| Data honesty | Generated / unverified scraper output is not production-approved |
| Demo datasets | Must be labelled `demo` or `synthetic` in `manifest.json` |
| API unchanged | Public HTTP contract stays stable unless strictly necessary |

---

## DATA-001 — Central runtime data contract

| Field | Value |
|-------|-------|
| **Branch** | `refactor/backend-runtime-data-contract` |
| **Goal** | Single resolver for runtime data paths; no data move; no deploy changes |
| **Files** | `backend/app/core/runtime_data.py`, `backend/app/core/config.py`, data-consuming services, `backend/tests/test_runtime_data.py` |
| **Dependencies** | None |
| **Acceptance** | All consumers use `app.core.runtime_data`; legacy `scraper/` paths isolated in resolver only; `RUNTIME_DATA_DIR` supported; tests pass |
| **Tests** | `backend/tests/test_runtime_data.py`; full `uv run pytest -q` |
| **Validate** | `cd backend && uv run pytest -q`; `git diff --check` |
| **Rollback** | Revert PR; services fall back to inline path resolution |
| **Out of scope** | Moving JSON files; Dockerfile; `railway.toml`; Compose; scraper changes |

**Status:** ✅ Complete — commit on `refactor/backend-runtime-data-contract` (pending merge).

---

## DATA-002 — Curated backend runtime dataset

| Field | Value |
|-------|-------|
| **Branch** | `data/backend-curated-runtime-dataset` |
| **Goal** | Create `backend/data/` as the intended sole runtime data directory |
| **Files** | `backend/data/manifest.json`, `backend/data/seeds/`, `dish_compare/`, `macros/`, `recipes/`, `backend/scripts/validate_runtime_data.py`, tests |
| **Dependencies** | DATA-001 merged |
| **Acceptance** | `manifest.json` describes `dataset_type`, provenance, limitations; validator passes; minimal required files only; no false `curated` labels for unverified data |
| **Tests** | Validator tests; loaders read via `RUNTIME_DATA_DIR=backend/data` |
| **Validate** | `uv run python scripts/validate_runtime_data.py`; `uv run pytest -q` |
| **Rollback** | Remove `backend/data/`; keep legacy paths via resolver fallback |
| **Out of scope** | Dockerfile; Railway; deleting legacy data; scraper pipeline fixes; network / new scraping |

### Data classification (required before copying)

Document a table per dataset:

| Dataset | Current path | Consumer | Trust status | Action |
|---------|--------------|----------|--------------|--------|
| *(fill during implementation)* | | | trusted / legacy / generated / unused | copy / demo / skip |

### Target layout

```text
backend/data/
├── manifest.json
├── seeds/
├── dish_compare/
├── macros/
│   └── ingredients_macros.json
└── recipes/
    └── recipes_pl.json
```

**Do not copy:** `ingredient_db_*.json`, `recipes_en.json`, other pipeline intermediates unless a consumer requires them.

**Status:** ⬜ Not started

---

## DATA-003 — Disconnect scraper from backend runtime

| Field | Value |
|-------|-------|
| **Branch** | `refactor/disconnect-scraper-from-backend` |
| **Goal** | Backend defaults to `backend/data/`; remove legacy monorepo/scraper fallbacks |
| **Files** | `backend/app/core/runtime_data.py`, services, tests, `scraper/README.md`, scraper output guards |
| **Dependencies** | DATA-002 merged |
| **Acceptance** | No `scraper/data` in `backend/app`; guard test passes; scraper cannot write `backend/data/` without explicit opt-in flag |
| **Tests** | Policy guard (`git grep` / pytest); full suite without `scraper/data` |
| **Validate** | `uv run pytest -q`; guard script |
| **Rollback** | Restore legacy fallback in resolver (revert PR) |
| **Out of scope** | Dockerfile; Railway; scraper algorithm fixes; removing `scraper/` directory |

**Status:** ⬜ Not started

---

## DATA-004 — Self-contained backend Docker image

| Field | Value |
|-------|-------|
| **Branch** | `docker/backend-self-contained-image` |
| **Goal** | `docker build backend/` — image needs no files outside `backend/` |
| **Files** | `backend/Dockerfile`, `backend/.dockerignore`, `docker-compose.yml`, `.github/workflows/ci.yml`; remove `backend/Dockerfile.railway` as active source |
| **Dependencies** | DATA-003 merged |
| **Acceptance** | `docker build -t ontrack-api backend/` succeeds; `/health` works; `backend/data/` in image; no `COPY scraper/`; Compose + CI use `context: ./backend` |
| **Tests** | CI `backend-docker`; container smoke; policy guards |
| **Validate** | `docker build backend/`; `uv run pytest -q`; CI green |
| **Rollback** | Restore `Dockerfile.railway` + root compose context |
| **Out of scope** | Root `railway.toml` removal; Railway UI changes |

**Status:** ⬜ Not started

---

## DATA-005 — Prepare Railway backend-root deployment

| Field | Value |
|-------|-------|
| **Branch** | `railway/prepare-backend-root-deployment` |
| **Goal** | Canonical `backend/railway.toml` ready for Root Directory `/backend` |
| **Files** | `backend/railway.toml`, `docs/deployment/RAILWAY_BACKEND_MIGRATION.md` |
| **Dependencies** | DATA-004 merged |
| **Acceptance** | `backend/railway.toml` valid; migration doc has deploy + rollback steps; root `railway.toml` **kept** for rollback |
| **Tests** | Local `docker build backend/` still passes |
| **Validate** | Doc review; config syntax matches existing Railway CaC format |
| **Rollback** | N/A (additive only) |
| **Out of scope** | Railway UI changes; deleting root `railway.toml` |

**Status:** ⬜ Not started

---

## Manual checkpoint (after DATA-005)

**Agent stops.** Operator must configure Railway manually:

| Setting | Value |
|---------|-------|
| Service | `ontrack-back` |
| Root Directory | `/backend` |
| Config File Path | `/backend/railway.toml` |

Then: deploy → build logs → deploy logs → `GET /health` → smoke critical endpoints.

**Do not start DATA-006** until operator confirms green deploy.

---

## DATA-006 — Remove legacy deployment config

| Field | Value |
|-------|-------|
| **Branch** | `chore/remove-legacy-deployment-config` |
| **Goal** | Delete deployment workarounds after Railway `/backend` deploy is verified |
| **Files** | root `railway.toml`, duplicate API configs (`backend/railway.prod.toml`, etc.), docs, CI, Compose references to `Dockerfile.railway` / repo-root context |
| **Dependencies** | DATA-005 merged **and** manual Railway checkpoint confirmed |
| **Acceptance** | One canonical API Railway config; one canonical `backend/Dockerfile`; no active `scraper/` runtime refs in docs/CI; full validation passes |
| **Tests** | Full pytest; `git grep` for stale paths |
| **Validate** | `uv run pytest -q`; `make validate`; CI green |
| **Rollback** | Restore root `railway.toml`; revert Railway UI to empty Root Directory |
| **Out of scope** | Worker service removal (separate decision); deleting `scraper/` experimental artifacts |

**Status:** ⬜ Not started — **blocked on manual checkpoint**

---

## Dependency graph

```text
DATA-001  Central runtime data contract
  └─ DATA-002  backend/data + manifest + validator
       └─ DATA-003  Disconnect scraper; remove legacy fallbacks
            └─ DATA-004  Self-contained Dockerfile (context backend/)
                 └─ DATA-005  backend/railway.toml + migration doc
                      └─ [MANUAL] Railway Root Directory = /backend
                           └─ DATA-006  Remove legacy deploy configs
```

---

## Branch naming convention

Use the exact branch names above (`refactor/…`, `data/…`, `docker/…`, `railway/…`, `chore/…`).

---

## Per-PR checklist (all implementation tasks)

- [ ] Scope limited to one roadmap task
- [ ] Targeted tests added or updated
- [ ] `cd backend && uv run pytest -q` passes
- [ ] `git diff --check` passes
- [ ] No Railway UI changes (until manual checkpoint)
- [ ] No push without user approval
- [ ] Rollback steps noted in PR description
- [ ] Public API contract unchanged (unless justified)

---

## Related documents

| Document | Purpose |
|----------|---------|
| [MIGRATION_ROADMAP.md](./MIGRATION_ROADMAP.md) | Flask → FastAPI migration (MIG-000–017) |
| [RAILWAY_STAGING.md](./RAILWAY_STAGING.md) | Current staging runbook (may be stale post DATA-004) |
| [PRODUCTION_CUTOVER.md](./PRODUCTION_CUTOVER.md) | Production cutover (update after DATA-006) |
| `docs/deployment/RAILWAY_BACKEND_MIGRATION.md` | Created in DATA-005 |

---

## Current next step

1. Merge **DATA-001** (`refactor/backend-runtime-data-contract`).
2. Implement **DATA-002** on `data/backend-curated-runtime-dataset`.
