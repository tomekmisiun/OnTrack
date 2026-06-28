# Context Map — OnTrack

Before editing, read the files listed for your **task type**. Start with
`.ai-rules/agent-orchestration.md`.

## Always read

| File | When |
|------|------|
| `.ai-rules/repository.md` | Every task |
| `.ai-rules/anti-overengineering.md` | Every task |
| `.ai-rules/git.md` | Before commit/push/merge |
| `.ai-rules/validation.md` | Before running validation commands |
| `.ai-rules/context-map.md` | You're here — pick a row below |

## Project layout (OnTrack)

| Area | Path | Notes |
|------|------|-------|
| **Backend (production)** | `backend/app/api/routes/`, `backend/app/models/`, `backend/app/services/` | FastAPI |
| **Frontend (production)** | `frontend-next/` | App Router; i18n in `lib/i18n/messages/` |
| **CRA reference** | `archive/frontend-cra-reference/` | Not deployed; archived parity reference |
| **Migrations** | `backend/alembic/` | Single head; `scripts/ensure_alembic_head.py` for legacy stamp |
| **Tests (backend)** | `backend/tests/` | Contract + integration |
| **Tests (frontend)** | `frontend-next/tests/` | Vitest unit tests |
| **API contract** | `docs/backend-migration/API_CONTRACT.md`, `frontend-next/openapi/openapi.json` | |
| **Docker** | `docker-compose.yml`, `frontend-next/Dockerfile`, `backend/Dockerfile` | |
| **CI** | `.github/workflows/ci.yml` | |
| **Deploy** | `.github/DEPLOY.md`, `docs/DEPLOYMENT.md` | CI-gated Railway deploy (`deploy-production`) |

## Task type → read list

### API / HTTP change
- `.ai-rules/api.md`, `.ai-rules/architecture.md`, `.ai-rules/testing.md`
- `docs/backend-migration/API_CONTRACT.md`
- `backend/app/api/routes/`
- `frontend-next/lib/api/`
- `backend/tests/contract/` for affected endpoints

### Database / model change
- `.ai-rules/database.md`, `.ai-rules/testing.md`
- `docs/backend-migration/DATABASE_COMPATIBILITY.md`
- `backend/app/models/`, `backend/alembic/versions/`

### Security / auth change
- `.ai-rules/security.md`, `.ai-rules/threat-modeling.md`, `.ai-rules/testing.md`
- `docs/backend-migration/AUTH_COMPATIBILITY.md`
- `backend/app/api/routes/auth.py`, `backend/app/core/config.py`, `.env.example`
- `backend/tests/contract/test_auth_contract.py`

### Background jobs / workers
- `.ai-rules/workers.md` (historical — worker scaffold removed per ADR 0002)

### Frontend change (only when explicitly in scope)
- `frontend-next/lib/i18n/messages/`
- Coordinate with `docs/backend-migration/API_CONTRACT.md` for API changes

### Docker / CI change
- `.ai-rules/docker.md`, `.ai-rules/documentation.md`
- `docker-compose.yml`, `backend/Dockerfile`, `frontend-next/Dockerfile`, `.github/workflows/`
- `.github/DEPLOY.md`

### Docs / migration planning
- `.ai-rules/documentation.md`, `.ai-rules/review.md`
- `README.md`, `docs/backend-migration/`, `docs/audits/`

### AI rules / workflow change
- `.ai-rules/documentation.md`, `docs/ai-workflows.md`
- `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/ontrack.mdc`
- `scripts/validate-ai-workflows.sh`

## Tracking files

| File | Purpose |
|------|---------|
| `docs/CURRENT_STATE.md` | Canonical project state |
| `docs/ROADMAP.md` | Active plans |
| `docs/TECH_DEBT.md` | Technical debt register |
| `docs/audits/archive/documentation-audit-2026-06-27.md` | Documentation reset audit (archived) |
| `.github/DEPLOY.md` | CI deploy quick reference → `docs/DEPLOYMENT.md` |

Do not invent roadmap or status files beyond what exists above.
