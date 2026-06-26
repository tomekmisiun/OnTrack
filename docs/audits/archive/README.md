# Archived documentation

These files are **historical**. They describe migration milestones, audits, or plans from specific dates. **Do not use them as current operational documentation.**

## Current sources of truth

| Topic | Document |
|-------|----------|
| Current state audit | [`PROJECT_CURRENT_STATE_AUDIT_2026-06-26.md`](../PROJECT_CURRENT_STATE_AUDIT_2026-06-26.md) |
| Remediation plan | [`../../PROJECT_REMEDIATION_ROADMAP.md`](../../PROJECT_REMEDIATION_ROADMAP.md) |
| Deployment | [`../../deployment/RAILWAY_BACKEND_MIGRATION.md`](../../deployment/RAILWAY_BACKEND_MIGRATION.md), [`.github/DEPLOY.md`](../../../.github/DEPLOY.md) |
| API contract | [`../../backend-migration/API_CONTRACT.md`](../../backend-migration/API_CONTRACT.md) |
| Catalog data | [`../../../backend/data/README.md`](../../../backend/data/README.md) |
| CRA comparison | [`../../CRA_REFERENCE.md`](../../CRA_REFERENCE.md) |

## Archive layout

| Path | Contents |
|------|----------|
| `2026-05-26_FULL_PROJECT_AUDIT.md` | Consolidated audit + remediation (May 2026) — superseded |
| `2026-05-26_PROJECT_TECHNICAL_AUDIT.md` | CRA-era technical audit — superseded |
| `cra-next-migration/` | CRA→Next.js migration reports and task plan |
| `backend-migration-completed/` | Completed MIG/DATA/CAT roadmaps and Flask cutover docs |
| `ai-rules/` | ai-agent-rules template adaptation checklist |

When citing historical decisions, include the **original date** and note that production is **FastAPI + Next.js** on `main`.
