# Archived cutover documentation

**Status:** Historical reference only (FastAPI + Next.js cutover completed).

These documents describe the Flask → FastAPI and CRA → Next.js migration process. **Do not follow rollback steps to Flask** unless executing a documented emergency procedure.

| Document | Notes |
|----------|-------|
| `PRODUCTION_CUTOVER.md` | Pre-cutover checklist; `REACT_APP_API_URL` references are obsolete |
| `CUTOVER_AND_ROLLBACK.md` | Rollback to Flask — **not applicable** to current production |
| `CURRENT_FLASK_INVENTORY.md` | Flask inventory snapshot |
| `MIGRATION_ROADMAP.md` | MIG task list — largely complete |

**Current production:**

- API: `backend/` (FastAPI)
- Frontend: `frontend-next/` (Next.js)
- Contract: `API_CONTRACT.md` + `frontend-next/openapi/openapi.json`
