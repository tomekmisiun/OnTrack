# OnTrack Flask → FastAPI migration documentation

Planning-only artifacts for migrating the OnTrack backend to FastAPI using
[`fastapi-production-foundation` v1.0.0](https://github.com/tomekmisiun/fastapi-production-foundation/tree/v1.0.0)
as a **reference foundation** (not a blind copy).

**Status:** MIG-000–MIG-004 ✅ · MIG-005+ in progress — see [MIGRATION_ROADMAP.md](./MIGRATION_ROADMAP.md).

## Reading order

1. **[API_CONTRACT.md](./API_CONTRACT.md)** — authoritative frontend consumer contract (start here for porting).
2. **[CURRENT_FLASK_INVENTORY.md](./CURRENT_FLASK_INVENTORY.md)** — existing Flask routes, models, tests, ops.
3. **[AUTH_COMPATIBILITY.md](./AUTH_COMPATIBILITY.md)** — JWT, passwords, OAuth; cutover decisions.
4. **[DATABASE_COMPATIBILITY.md](./DATABASE_COMPATIBILITY.md)** — tables, fresh vs production DB strategy.
5. **[TEMPLATE_TRIM_MATRIX.md](./TEMPLATE_TRIM_MATRIX.md)** — what to keep/adapt/defer/remove from the foundation.
6. **[TARGET_ARCHITECTURE.md](./TARGET_ARCHITECTURE.md)** — target `backend/` layout and layer rules.
7. **[MIGRATION_ROADMAP.md](./MIGRATION_ROADMAP.md)** — one-task-per-branch implementation plan.
8. **[CUTOVER_AND_ROLLBACK.md](./CUTOVER_AND_ROLLBACK.md)** — Railway staging, rehearsal, production switch.

## Principles (non-negotiable)

| Principle | Detail |
|-----------|--------|
| Frontend unchanged | No edits to React components, CSS, `LanguageContext`, routing, or tour during migration. |
| Contract-first | FastAPI must adapt to `frontend/src/api.js` + `AuthContext.js`, not template defaults. |
| Parallel backends | Flask remains until FastAPI passes contract + domain tests. |
| Monorepo target | `frontend/` + new `backend/` + root `docker-compose.yml`. |
| Production safety | Never run foundation or greenfield `CREATE TABLE` migrations against live Railway data without baseline/stamp validation. |

## Repository state at plan time

| Item | Value |
|------|-------|
| Branch | `main` (uncommitted: `README.md` only) |
| Remote | `origin` → `https://github.com/tomekmisiun/OnTrack.git` |
| Instruction files | No `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`, or `.ai-rules/` in OnTrack |
| Reference clone | `/tmp/fastapi-production-foundation-reference` @ tag `v1.0.0` (read-only) |

## Next step

Implement **MIG-001** on branch `mig-001-fastapi-skeleton` — see [MIGRATION_ROADMAP.md](./MIGRATION_ROADMAP.md).
