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
| Flask backend (legacy) | `app/routes/`, `app/models/`, `app/services/` | Keep until FastAPI cutover |
| FastAPI backend (target) | `backend/app/api/routes/`, `backend/app/models/`, `backend/app/services/` | Migration in progress |
| Frontend (Next.js) | `frontend-next/` | App Router UI, i18n in `lib/i18n/translations.ts` |
| Flask migrations | `migrations/versions/` | Must stay in repo for Railway |
| FastAPI migrations | `backend/alembic/` | Future — OnTrack-only chain |
| Tests (Flask) | `tests/` | pytest, sqlite in-memory |
| Tests (FastAPI) | `backend/tests/` | Future |
| Migration plan | `docs/backend-migration/` | API contract, roadmap |
| Docker | `docker-compose.yml`, `frontend-next/Dockerfile` | Local dev stack |
| CI | `.github/workflows/ci.yml` | pytest on push/PR |
| Deploy | `.github/DEPLOY.md` | Railway Wait for CI |

## Task type → read list

### API / HTTP change
- `.ai-rules/api.md`, `.ai-rules/architecture.md`, `.ai-rules/testing.md`
- `docs/backend-migration/API_CONTRACT.md` — **frontend contract is authoritative**
- `app/routes/` and/or `backend/app/api/routes/`
- `frontend-next/lib/api/` — typed HTTP client (OpenAPI-generated types)
- `tests/` or `backend/tests/contract/` for affected endpoints

### Database / model change
- `.ai-rules/database.md`, `.ai-rules/testing.md`
- `docs/backend-migration/DATABASE_COMPATIBILITY.md`
- `app/models/`, `migrations/versions/`, future `backend/app/models/`
- Never run external FastAPI starter migrations on the OnTrack database

### Security / auth change
- `.ai-rules/security.md`, `.ai-rules/threat-modeling.md`, `.ai-rules/testing.md`
- `docs/backend-migration/AUTH_COMPATIBILITY.md`
- `app/routes/auth.py`, `config.py`, `.env.example`
- `tests/test_auth.py`, `tests/test_local_auth.py`, `tests/test_oauth.py`

### Background jobs / workers
- `.ai-rules/workers.md`
- `app/routes/auth.py` (threading seed today); future `backend/app/worker/`
- Target: replace threads with Redis worker (MIG-012)

### Frontend change (only when explicitly in scope)
- `frontend-next/lib/i18n/translations.ts`
- Do not break `api.js` contract without backend coordination

### Docker / CI change
- `.ai-rules/docker.md`, `.ai-rules/documentation.md`
- `docker-compose.yml`, `Dockerfile`, `.github/workflows/`
- `.github/DEPLOY.md`

### Docs / migration planning
- `.ai-rules/documentation.md`, `.ai-rules/review.md`
- `README.md`, `docs/backend-migration/`

### AI rules / workflow change
- `.ai-rules/documentation.md`, `docs/ai-workflows.md`
- `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/project.mdc`
- `scripts/validate-ai-workflows.sh`

## Tracking files

| File | Purpose |
|------|---------|
| `docs/backend-migration/MIGRATION_ROADMAP.md` | Backend migration tasks (MIG-xxx) |
| `docs/ADAPTATION_CHECKLIST.md` | AI rules adoption checklist |
| `.github/DEPLOY.md` | Production deploy workflow |

Do not invent roadmap or status files beyond what exists above.
