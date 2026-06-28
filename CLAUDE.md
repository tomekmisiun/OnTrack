# CLAUDE.md

Binding project rules live in **`.ai-rules/`**. Read the relevant files before
making changes. Do not duplicate rule bodies here.

Workflow overview: **`docs/development/ai/workflows.md`** · Two-agent review:
**`docs/development/ai/workflows.md`**

After every non-trivial file-changing task, Claude Code MUST run a read-only
Reviewer before the final response: first try cross-provider review via
`scripts/ai/invoke-cross-reviewer.sh codex`, falling back to the native
`code-reviewer` subagent (`.claude/agents/code-reviewer.md`) if Codex is
unavailable. No second user prompt, pasted handoff, local runner command, or
separate CLI window is required. The final response must include the Builder
summary and Reviewer verdict. Read-only or trivial tasks may skip Reviewer only
with an explicit reason. See `.ai-rules/agent-orchestration.md` §8 and
`.ai-rules/model-routing.md`.

## Binding rules (`.ai-rules/`)

### Core
- `repository.md` — scope, config hygiene, enforcement split
- `architecture.md` — layers, dependencies
- `api.md` — HTTP/API conventions
- `database.md` — ORM and migrations
- `security.md` — secrets, auth, production validators
- `testing.md` — test requirements and integrity
- `docker.md` — containers and compose safety
- `documentation.md` — README, docs, tracking files
- `git.md` — branches, commits (no AI attribution trailers), push/merge approval
- `anti-overengineering.md` — avoid unnecessary abstractions, files, dependencies
- `validation.md` — validation commands for the target repository

### Workflow (how to work)
- `agent-orchestration.md` — start every task here
- `model-routing.md` — model/tier selection and cross-provider review
- `context-map.md` — task type → files to read
- `spec-driven-development.md` — specs for non-trivial work
- `planning-and-task-breakdown.md` — task cards and ordering
- `incremental-work.md` — thin slices and validation cadence
- `tdd-and-regression.md` — failing test first, regression guards
- `review.md` — pre-merge checklist
- `learning-mode.md` — mentor-style completion format for non-trivial tasks
- `threat-modeling.md` — auth, uploads, webhooks, workers
- `workers.md` — background jobs (when applicable)

## Optional (not binding)

- **`agents/`** — review personas
- **`.commands/`** — prompt formats and procedures
- **`docs/development/ai/workflows.md`** — Builder / Reviewer handoff pattern
- **`docs/specs/`** — feature spec conventions

## Validation

- This template: `make validate`
- Consumer repos: commands in `.ai-rules/validation.md` and README

Update `.ai-rules/` when changing project rules. Keep this file as an index only.
