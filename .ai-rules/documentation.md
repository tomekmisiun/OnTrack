# Documentation Rules

`.ai-rules/` governs agent behavior. User-facing documentation lives in
`README.md`, `docs/`, and any tracking files the target repository defines.

## Accuracy

- MUST NOT invent features, endpoints, or completed work.
- Document only behavior that exists in code and tests.
- Before documenting APIs, verify routes in code or generated API docs.

## README

Update `README.md` when a change affects:

- setup, containers, environment variables, migrations, tests, or workflows
- API overview, auth flow, roles, permissions, or rate limiting
- known production gaps

Do not update `README.md` for refactors that do not change behavior, setup, API,
configuration, migrations, or workflows.

## Docs directory

- Auth, deploy, migration, worker, data isolation, or observability changes
  MUST update the matching file under `docs/` when one exists.

## Project tracking files

Use only files defined by the target repository (for example backlog, status, or
tech-debt registers). MUST NOT mark planned work as complete without code and
tests.

## AI rules and workflows

- Binding rules: `.ai-rules/` (see `AGENTS.md`, `docs/ai-workflows.md`).
- Optional personas: `agents/`; optional prompts: `.commands/`.
- Feature specs: `docs/specs/`; ADRs if the project uses them.
- After changing workflow files, run the validation command defined by the
  repository (`make validate` in this template).

## Writing style

- Keep wording clear, technical, and concise.
- Avoid hype, marketing language, excessive badges, and emojis.
- Prefer commands and examples that match the target repository.
