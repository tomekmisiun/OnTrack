# Repository Rules

## Scope

- Documentation-only or AI-rules-only tasks MUST NOT modify application runtime
  code unless the task explicitly requires it.
- MUST NOT make unrelated drive-by refactors when implementing a scoped task.

## Configuration

- Use environment files for local secrets. MUST NOT commit `.env` or equivalent.
- Keep example env files limited to safe placeholders.
- MUST NOT hardcode secrets in code, container files, or docs.

## Enforcement vs policy

- Mechanical checks live in CI, pre-commit, and policy documentation when the
  target repository defines them.
- `.ai-rules/` keeps judgment rules that automation cannot enforce.
- Commit messages MUST NOT contain AI attribution trailers — see `.ai-rules/git.md`.

## Source of truth for AI rules

- `.ai-rules/` is the only source of truth for **binding** AI/project rules.
- `AGENTS.md`, `CLAUDE.md`, and `.cursor/rules/*.mdc` MUST only point to
  `.ai-rules/` and workflow indexes — MUST NOT duplicate rule bodies.
- `agents/` and `.commands/` are optional workflow aids (see `docs/ai-workflows.md`).
