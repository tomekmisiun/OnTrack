# OnTrack backend migration documentation

**Status:** Flask → FastAPI migration **complete**. Runtime data pipeline **complete**. Catalog + locale/market model **complete**.

**Current state:** [`docs/CURRENT_STATE.md`](../CURRENT_STATE.md)  
**Roadmap:** [`docs/ROADMAP.md`](../ROADMAP.md) · **Debt:** [`docs/TECH_DEBT.md`](../TECH_DEBT.md)

## Living documents (use these)

| Document | Purpose |
|----------|---------|
| [API_CONTRACT.md](./API_CONTRACT.md) | Frontend ↔ FastAPI contract (`frontend-next/lib/api/`) |
| [AUTH_COMPATIBILITY.md](./AUTH_COMPATIBILITY.md) | JWT, passwords, OAuth parity notes (historical analysis + decisions) |
| [DATABASE_COMPATIBILITY.md](./DATABASE_COMPATIBILITY.md) | Schema inventory and Alembic strategy |
| [DB_REHEARSAL.md](./DB_REHEARSAL.md) | Staging DB migration rehearsal |
| [ARCHIVED_CUTOVER_DOCS.md](./ARCHIVED_CUTOVER_DOCS.md) | Index of historical cutover docs |
| [../DEPLOYMENT.md](../DEPLOYMENT.md) | Production Railway deploy |
| [../../.github/DEPLOY.md](../../.github/DEPLOY.md) | CI-gated deploy (short reference) |
| [../../backend/data/README.md](../../backend/data/README.md) | Catalog data workflow |

## Archived (historical only)

Completed roadmaps, Flask inventory, and cutover procedures:

[`docs/audits/archive/backend-migration-completed/`](../audits/archive/backend-migration-completed/)

Do **not** follow Flask rollback or CRA frontend contract instructions from archived files.

## Production stack (current)

- **API:** `backend/` — FastAPI, Alembic head `d3e4f5a6b7c8` (verify with `uv run alembic current`)
- **Frontend:** `frontend-next/` — Next.js 15 App Router
- **Deploy:** Railway `ontrack-back` + `ontrackapp` via GitHub Actions on green `main`
