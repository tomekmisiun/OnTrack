# Archived cutover documentation

**Status:** Historical reference only (FastAPI + Next.js cutover completed).

These documents were moved to [`docs/audits/archive/backend-migration-completed/`](../audits/archive/backend-migration-completed/). **Do not follow rollback steps to Flask.**

| Document (archived path) | Notes |
|----------|-------|
| `PRODUCTION_CUTOVER.md` | Pre-cutover checklist; obsolete env var names |
| `CUTOVER_AND_ROLLBACK.md` | Rollback to Flask — **not applicable** |
| `CURRENT_FLASK_INVENTORY.md` | Flask inventory snapshot |
| `MIGRATION_ROADMAP.md` | MIG task list — complete |
| `DATA_DEPLOYMENT_ROADMAP.md` | DATA tasks — complete |
| `PRODUCT_CATALOG_ROADMAP.md` | CAT tasks — complete |

**Current production:**

- API: `backend/` (FastAPI)
- Frontend: `frontend-next/` (Next.js)
- Contract: `API_CONTRACT.md` + `frontend-next/openapi/openapi.json`
- Current state: [`docs/CURRENT_STATE.md`](../CURRENT_STATE.md)
