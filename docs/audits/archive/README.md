# Archived documentation

These files are **historical**. They describe migration milestones, audits, or plans from specific dates. **Do not use them as current operational documentation.**

**Current state:** [`docs/CURRENT_STATE.md`](../../CURRENT_STATE.md)

## Validation

These files are **excluded from markdown link checks** in `scripts/validate-ai-workflows.sh`. They are point-in-time snapshots; links to removed paths or renamed docs are expected and must not block CI on active documentation.

Active docs under `docs/` (outside this archive) remain fully validated.

## Archive layout

| Path | Contents |
|------|----------|
| `PROJECT_CURRENT_STATE_AUDIT_2026-06-26.md` | June 2026 point-in-time audit (superseded) |
| `2026-05-26_FULL_PROJECT_AUDIT.md` | Consolidated audit (May 2026) |
| `2026-05-26_PROJECT_TECHNICAL_AUDIT.md` | Technical audit (May 2026) |
| `cra-next-migration/` | Frontend migration reports |
| `backend-migration-completed/` | Backend migration roadmaps |
| `ui-locale-market-separation-audit.md` | Pre-implementation locale/market audit |
| `FRONTEND_NEXT_BFF.md` | BFF threat model (condensed in `docs/SECURITY.md`) |
| `ai-rules/` | ai-agent-rules adaptation checklist |

When citing historical decisions, include the **original date**. Production stack on `main`: **FastAPI + Next.js**.
