# Adaptation Checklist — OnTrack

Completed when adopting [ai-agent-rules-template](https://github.com/tomekmisiun/ai-agent-rules-template) into this repo.

## Project identity

- [x] Update README with product name and purpose
- [x] Remove or replace template-only documentation links (template `reference/` not copied)

## Stack and layout

- [x] Programming language and framework documented (`README.md`, `docs/backend-migration/`)
- [x] Replace placeholders in `.ai-rules/context-map.md` (Flask `app/`, `frontend/`, future `backend/`)
- [x] Update `.cursor/rules/backend.mdc` globs (`app/**`, `tests/**`, `backend/**`, `migrations/**`)
- [x] Add `.cursor/rules/ontrack.mdc` and `frontend.mdc` for product-specific rules
- [x] Keep `.ai-rules/workers.md` (threading seed today; Redis worker planned MIG-012)

## Validation

- [x] Fill `.ai-rules/validation.md` with real commands (pytest, docker compose, `make validate`)
- [x] Wire `make validate` → `scripts/validate-ai-workflows.sh`
- [ ] Add CI job for static AI validation (optional)

## Git and branches

- [x] Default branch `main`; PR + CI before deploy (`.github/DEPLOY.md`)
- [ ] Add commit-trailer guards if desired

## Docker and infrastructure

- [x] Document compose services in `.ai-rules/validation.md` (`app`, `frontend`, `db`)
- [ ] Update `.cursor/rules/docker.mdc` globs if compose paths change

## Database

- [x] Migration paths in `.ai-rules/context-map.md` (`migrations/`, future `backend/alembic/`)
- [ ] Customize `agents/database-reviewer.md` for OnTrack schema (optional)

## Security

- [ ] Document auth model in `agents/security-auditor.md` (see `docs/backend-migration/AUTH_COMPATIBILITY.md`)
- [ ] Multi-tenant rules — N/A (single-user app)

## Backlog and tracking

- [x] Executable backlog: `docs/backend-migration/MIGRATION_ROADMAP.md` (MIG-xxx)
- [x] No invented status files beyond migration docs

## Reviewers

- [ ] Verify `claude` and/or `codex` on PATH for cross-provider review
- [ ] Create `.ai-review.env` from `examples/ai-review.env.example` (local only)

## CI

- [ ] Integrate static AI validation workflow (optional)
- [x] Application CI separate (`.github/workflows/ci.yml` — pytest)

## Final checks

- [x] `make validate` passes
- [x] No machine-specific absolute paths in adapted files
- [x] No secrets in committed files
