# OnTrack backend migration documentation

**Status:** Flask → FastAPI migration **complete** (MIG-000–017). Runtime data pipeline **complete** (DATA-001–006). Catalog architecture **complete** (CAT-001–008).

**Current state:** [`docs/audits/PROJECT_CURRENT_STATE_AUDIT_2026-06-26.md`](../audits/PROJECT_CURRENT_STATE_AUDIT_2026-06-26.md)
**Remediation plan:** [`docs/PROJECT_REMEDIATION_ROADMAP.md`](../PROJECT_REMEDIATION_ROADMAP.md)

## Living documents (use these)

| Document | Purpose |
|----------|---------|
| [API_CONTRACT.md](./API_CONTRACT.md) | Frontend ↔ FastAPI contract (`frontend-next/lib/api/`) |
| [AUTH_COMPATIBILITY.md](./AUTH_COMPATIBILITY.md) | JWT, passwords, OAuth decisions |
| [DATABASE_COMPATIBILITY.md](./DATABASE_COMPATIBILITY.md) | Schema and Alembic strategy |
| [DB_REHEARSAL.md](./DB_REHEARSAL.md) | Staging DB migration rehearsal |
| [RAILWAY_STAGING.md](./RAILWAY_STAGING.md) | Staging deploy notes |
| [ARCHIVED_CUTOVER_DOCS.md](./ARCHIVED_CUTOVER_DOCS.md) | Index of historical cutover docs |
| [../deployment/RAILWAY_BACKEND_MIGRATION.md](../deployment/RAILWAY_BACKEND_MIGRATION.md) | Production Railway runbook |
| [../../.github/DEPLOY.md](../../.github/DEPLOY.md) | CI-gated deploy |
| [../../backend/data/README.md](../../backend/data/README.md) | Catalog data workflow |

## Archived (historical only)

Completed roadmaps, Flask inventory, and cutover procedures moved to:

[`docs/audits/archive/backend-migration-completed/`](../audits/archive/backend-migration-completed/)

Do **not** follow Flask rollback or `frontend/src/api.js` contract instructions from archived files.

## Production stack (current)

- **API:** `backend/` — FastAPI, Alembic, `import_catalog`
- **Frontend:** `frontend-next/` — Next.js 15 App Router
- **Deploy:** Railway `ontrack-back` + `ontrackapp` via GitHub Actions on green `main`
