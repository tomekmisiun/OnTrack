# Documentation Rules

`.ai-rules/` governs agent behavior. User-facing documentation lives in
`README.md`, `docs/`, and any tracking files the target repository defines.

**Style reference:** organizational patterns from [jaktestowac](https://github.com/jaktestowac)
repos ([awesome-copilot-for-testers](https://github.com/jaktestowac/awesome-copilot-for-testers),
[playwright-tools](https://github.com/jaktestowac/playwright-tools),
[testcontainers-example](https://github.com/jaktestowac/testcontainers-example)).
Adopt structure and clarity — do **not** copy their marketing text, contact
footers, course links, or Playwright-specific content into OnTrack docs.

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

## jaktestowac-style layout (OnTrack adaptation)

Write for someone seeing the project for the first time. Prefer **practical,
scannable docs** over long prose.

### README structure (recommended order)

1. **Title + one-line purpose** — what the project is and which problem it solves.
2. **Badges row** — only real badges (CI, stack, license). Each badge links to
   a working destination.
3. **Horizontal rule** (`---`) before major sections when README is longer than
   ~80 lines.
4. **Table of contents** — anchor links for READMEs with 6+ sections.
5. **About / What it does** — short bullet list of capabilities (not marketing
   slogans).
6. **Stack / Architecture** — one diagram or code block, then link to
   `docs/ARCHITECTURE.md` for detail.
7. **Requirements** — table or bullet list of tools and versions.
8. **Quick start** — copy-paste commands in fenced blocks; match real npm/Make
   scripts exactly.
9. **Configuration** — env vars table with purpose column; link to
   `.env.example`.
10. **Development** — how to run backend and frontend separately.
11. **Testing** — command table (`make test`, etc.); link to `docs/TESTING.md`.
12. **Validation / linting** — exact commands.
13. **Deployment** — short summary; link to `docs/DEPLOYMENT.md`.
14. **Documentation index** — table: Document | Contents | path.
15. **Limitations** — known gaps only (verified).

### Section patterns (from jaktestowac)

| Pattern | When to use | Example |
|---------|-------------|---------|
| `## Requirements` | Prerequisites before first run | Node 24, Docker, Postgres 15 |
| `## How to` / `## Quick start` | First successful run | `docker compose up --build` |
| `## Features` or `## What it does` | Capability overview | Bullet list, bold lead term |
| Command block + short intro | Runnable steps | “Run following commands.” then fenced block |
| Resource table | Doc navigation | `\| Document \| Contents \|` |
| `---` separator | Between major blocks | After badges, before TOC |
| Callout (`> [!TIP]`) | Non-obvious but important note | Link to deeper doc instead of duplicating |
| `> [!IMPORTANT]` | Safety, auth, or deploy gate | Staging before production |
| Link-out | Deep detail | “See [TESTING.md](docs/TESTING.md)” |

Use callouts sparingly — one or two per doc, not on every section.

### Emojis and tone

jaktestowac uses emojis in section headers for scanability. For OnTrack:

- **Optional** in README section headers (`## Testing`, not required `## 🧪 Testing`).
- **Avoid** emoji spam, decorative badges, and portfolio-style closings.
- Tone: clear, technical, helpful — like a good workshop handout, not a landing page.

### What NOT to copy from jaktestowac

- Contact / Discord / course promotion blocks (unless OnTrack adds its own support channel).
- “Happy testing!” footers and team sign-offs.
- Playwright learning-resource lists (OnTrack removed browser E2E).
- Install-badge columns for VS Code extensions.
- Marketing claims (“comprehensive”, “professional”) without code evidence.

## README maintenance

Update `README.md` when a change affects:

- setup, containers, environment variables, migrations, tests, or workflows
- API overview, auth flow, roles, permissions, or rate limiting
- known production gaps

Do not update `README.md` for refactors that do not change behavior, setup, API,
configuration, migrations, or workflows.

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

Long docs (`TESTING.md`, `DEPLOYMENT.md`, `ARCHITECTURE.md`) MUST have:

- Table of contents with anchor links at the top.
- Command tables mapping task → exact command.
- CI job matrix table when tests or deploy are described.
- “Related” links at the bottom — not duplicated content from other docs.

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
- Rules for choosing the right test level when adding new tests
- Accepted gaps (documented trade-offs, not hidden)

Include a change → test mapping table:

| Change | Required test |
|--------|---------------|
| Service logic | Unit or service test |
| API endpoint | API integration test |
| DB migration | Migration or integration test |
| UI component | Component test |
| Critical browser-only flow | E2E only when lower levels are insufficient |
| Purely visual change | Manual review or targeted component assertion — not full-page screenshots |

## Code blocks and commands

- Every command MUST match an existing script, Makefile target, or CI step.
- Prefer full copy-paste blocks over inline fragments.
- Show required env vars in a table or shell block before the command when non-obvious.
- For multi-step flows, use numbered steps or a single fenced block per step.

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
- Avoid hype, empty slogans, and portfolio-style generated descriptions.
- Prefer commands, tables, and examples that match the target repository.
- Link to focused docs instead of repeating their content in README.
- Update docs whenever changes affect install, architecture, configuration,
  tests, CI, or deployment.
