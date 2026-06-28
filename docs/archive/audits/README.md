# Archived documentation

These files are **historical**. They describe migration milestones, audits, or plans from specific dates. **Do not use them as current operational documentation.**

**Current state:** [`docs/CURRENT_STATE.md`](../../CURRENT_STATE.md)

## Validation

These files are **excluded from markdown link checks** in `scripts/validate-ai-workflows.sh`. They are point-in-time snapshots; links to removed paths or renamed docs are expected and must not block CI on active documentation.

Active docs under `docs/` (outside this archive) remain fully validated.

## Archived documents (June 2026 audits)

| Archived document | Reason | Current source of truth |
|---|---|---|
| `documentation-audit-2026-06-27.md` | Point-in-time inventory before docs reset (#163) | [`../../README.md`](../../README.md), [`../../CURRENT_STATE.md`](../../CURRENT_STATE.md) |
| `docs-and-test-audit-2026-06-27.md` | Playwright removal + CI simplification snapshot | [`../../TESTING.md`](../../TESTING.md) |
| `dead-code-audit-2026-06-27.md` | Dead-code inventory (Tasks 1–9 merged) | [`../../TECH_DEBT.md`](../../TECH_DEBT.md), [`../../ROADMAP.md`](../../ROADMAP.md) |

## Archive layout

| Path | Contents |
|------|----------|
| `documentation-audit-2026-06-27.md` | June 2026 documentation reset audit (#163) |
| `docs-and-test-audit-2026-06-27.md` | June 2026 docs + Playwright removal audit |
| `dead-code-audit-2026-06-27.md` | June 2026 dead-code audit (Tasks 1–9 merged) |
| `PROJECT_CURRENT_STATE_AUDIT_2026-06-26.md` | June 2026 point-in-time audit (superseded) |
| `2026-05-26_FULL_PROJECT_AUDIT.md` | Consolidated audit (May 2026) |
| `2026-05-26_PROJECT_TECHNICAL_AUDIT.md` | Technical audit (May 2026) |
| `cra-next-migration/` | Frontend migration reports |
| `backend-migration-completed/` | Backend migration roadmaps |
| `ui-locale-market-separation-audit.md` | Pre-implementation locale/market audit |
| `FRONTEND_NEXT_BFF.md` | BFF threat model (condensed in `docs/SECURITY.md`) |
| `ai-rules/` | ai-agent-rules adaptation checklist |

When citing historical decisions, include the **original date**. Production stack on `main`: **FastAPI + Next.js**.
