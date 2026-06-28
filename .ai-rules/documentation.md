# Documentation Rules

`.ai-rules/` governs agent behavior. User-facing documentation lives in
`README.md`, `docs/`, and any tracking files the target repository defines.

## Core principle

> Documentation MUST describe the verified state of the repository, not a
> planned or assumed state of the system.

Verify against code, tests, CI workflows, and configuration before writing or
updating docs.

## Accuracy

- MUST NOT invent features, endpoints, or completed work.
- Document only behavior that exists in code and tests.
- Before documenting APIs, verify routes in code or generated API docs.
- Do not state fixed test counts — show commands instead (counts drift quickly).
- Do not present roadmap items as shipped features.
- Badges MUST link to real, working workflows or services.

## Audience and structure

Write for someone seeing the project for the first time.

| Element | Requirement |
|---------|-------------|
| Opening | Clear statement of what the project is and which problem it solves |
| Long docs | Table of contents or clear navigation |
| Quick start | Copy-paste commands that match real scripts |
| Sections | Separate requirements, install, configuration, run, and test |
| Examples | Practical, runnable examples |
| Deep detail | Link to focused docs — do not duplicate full content in README |
| Troubleshooting | Common pitfalls section when repeat issues exist |

## README

Update `README.md` when a change affects:

- setup, containers, environment variables, migrations, tests, or workflows
- API overview, auth flow, roles, permissions, or rate limiting
- known production gaps

Do not update `README.md` for refactors that do not change behavior, setup, API,
configuration, migrations, or workflows.

README MUST include (when applicable):

1. Project name and one-line purpose
2. Real badges only (e.g. CI status)
3. Problem the app solves and key capabilities
4. Table of contents for longer READMEs
5. High-level architecture and stack
6. Local prerequisites
7. Quick start with exact commands
8. Environment configuration summary
9. How to run backend and frontend
10. Migrations and seed data (if applicable)
11. Testing entry points (details in `docs/TESTING.md`)
12. Linting and validation
13. Deployment summary (details in `docs/DEPLOYMENT.md`)
14. Security notes and known limitations
15. Links to detailed documentation

## Docs directory

Preferred layout (create only when needed):

| File | Purpose |
|------|---------|
| `README.md` | Project entry point |
| `docs/ARCHITECTURE.md` | Architecture when it needs a dedicated doc |
| `docs/TESTING.md` | Complete test strategy and CI mapping |
| `docs/DEPLOYMENT.md` | Real deployment process |
| `docs/SECURITY.md` | Security mechanisms when non-trivial |
| `docs/ROADMAP.md` | Active future work only |
| `docs/TECH_DEBT.md` | Confirmed, still-open debt only |
| `docs/adr/` | Permanent architecture decisions |

- Auth, deploy, migration, worker, data isolation, or observability changes
  MUST update the matching file under `docs/` when one exists.
- Remove or merge duplicate docs; keep valuable decision history in ADRs.
- Do not create files just to fill a template — add docs when they reduce confusion.

## Project tracking files

Use only files defined by the target repository (for example backlog, status, or
tech-debt registers). MUST NOT mark planned work as complete without code and
tests. Remove resolved items from `TECH_DEBT.md` and mark completed roadmap items
as Done with evidence.

## Testing documentation

`docs/TESTING.md` MUST describe:

- Test strategy goal and pyramid levels
- Directories and responsibility per level
- Exact commands (fast, backend, frontend, full validation)
- Required services (Postgres, etc.)
- Test database setup
- Running a single test
- Coverage generation (if used)
- CI job mapping
- Rules for choosing test hes to add new tests
- Playwright/E2E decision and rationale (if any browser tests remain)

Include a change → test mapping table, for example:

| Change | Required test |
|--------|---------------|
| Service logic | Unit or service test |
| API endpoint | API integration test |
| DB migration | Migration or integration test |
| UI component | Component test |
| Critical browser-only flow | E2E only when lower levels are insufficient |
| Purely visual change | Manual review or targeted component assertion — not full-page screenshots |

## AI rules and workflows

- Binding rules: `.ai-rules/` (see `AGENTS.md`, `docs/ai-workflows.md`).
- Optional personas: `agents/`; optional prompts: `.commands/`.
- Feature specs: `docs/specs/`; ADRs if the project uses them.
- Do not duplicate binding rule bodies in `AGENTS.md`, `CLAUDE.md`, or
  `.cursor/rules/` — index and point to `.ai-rules/` instead.
- After changing workflow files, run the validation command defined by the
  repository (`make validate` in this template).

## Writing style

- Keep wording clear, technical, and concise.
- Avoid hype, marketing language, excessive badges, and emojis.
- Prefer commands and examples that match the target repository.
- No empty slogans or portfolio-style generated descriptions.
- Update docs whenever changes affect install, architecture, configuration,
  tests, CI, or deployment.
