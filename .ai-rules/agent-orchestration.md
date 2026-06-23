# Agent Orchestration

Use this file at the **start of every non-trivial task**. It complements
tool-specific entry points (`AGENTS.md`, `CLAUDE.md`) and binding rules in other
`.ai-rules/` files.

## 0. Project identity

This repository is a **target application or rules template**. Before editing,
orient using the repository README and any project-specific configuration the
target repo documents (for example `docs/ADAPTATION_CHECKLIST.md` in this
template, or equivalent onboarding docs in a consumer repo).

Distinguish:

- **Application code** — runtime source, tests, migrations, infrastructure.
- **Project documentation** — README, architecture docs, backlog/tracking files
  defined by the target repository.
- **AI workflow/rules** — `.ai-rules/`, `AGENTS.md`, `CLAUDE.md`,
  `docs/ai-workflows.md`, `.commands/`, `agents/`.

For product work, pick the next item from the **executable backlog** the target
repository defines (not a high-level roadmap unless the user specifies otherwise).

## 1. Classify the task

| Type | Examples | Load first |
|------|----------|------------|
| Bug fix | Wrong status code, regression | `tdd-and-regression.md`, `context-map.md` |
| Feature | New endpoint, service workflow | `spec-driven-development.md`, `incremental-work.md` |
| Refactor | Rename, extract, no behavior change | `incremental-work.md`, `architecture.md` |
| Security | Auth, uploads, webhooks | `threat-modeling.md`, `security.md` |
| Infra | Docker, CI, Makefile | `docker.md`, `context-map.md` |
| Docs / status | README, tracking files | `documentation.md`, `review.md` |
| Roadmap / debt | Backlog or tech-debt item | `planning-and-task-breakdown.md`, `incremental-work.md` |

## 2. Load relevant rules

- Read `.ai-rules/context-map.md` and open the listed files for this task type.
- Read binding rules that apply (architecture, testing, security, git, etc.).
- Optional: use a persona from `agents/` for review-only work (see
  `docs/ai-workflows.md`).

## 3. Define scope

- State the **objective** in one sentence.
- Name the affected layer(s) for the target repository (application runtime,
  integration, infrastructure/CI, documentation, or AI workflow/rules).
- Classify the task kind for the completion report: docs-only, backend runtime,
  integration, CI/infra, or rules/workflow.
- List **in scope** and **out of scope** explicitly.
- Do not expand scope (no drive-by refactors, no unrelated docs, no low-priority
  work unless requested).

## 4. Run the anti-overengineering check

Before adding files, dependencies, abstractions, or large rewrites, apply
`.ai-rules/anti-overengineering.md`:

- Can existing code or project patterns solve this?
- Can code be deleted or simplified instead of added?
- Is a new dependency, file, abstraction, or generic framework actually needed?
- Are security, validation, errors, tests, and production safety still covered?

## 5. List assumptions

- Note defaults you are using (environment, API versioning, data isolation model).
- If blocked on a product decision, ask **one** focused question; otherwise
  proceed with the smallest safe default and document it.

## 6. Pick validation commands

Choose validation based on which files changed. Use the validation command
defined by the target repository (see `.ai-rules/validation.md` and README).

| Change type | First (fast feedback) | Before PR |
|-------------|------------------------|-----------|
| Docs-only (no AI workflow files touched) | none required | — |
| AI workflow / `.ai-rules` files changed | `make validate` (this template) or `make validate-ai-workflows` in consumer repos | — |
| Application code | targeted tests for the touched module | full validation command from target repo if non-trivial |
| Migrations / models | relevant migration/model tests | full validation command from target repo |
| Docker / CI / Makefile | most relevant local check for that layer | policy guards + full validation if app code also changed |

### CI is the final gate

Targeted local tests give fast feedback during a slice. Full local validation
is preferred before opening a PR for application/runtime changes, but CI remains
authoritative — local validation does not replace a green CI run before merge.

## 7. Execute incrementally

Follow `.ai-rules/incremental-work.md` and `.ai-rules/planning-and-task-breakdown.md`.

## 8. Report completion

For every non-trivial task that changes files, the Builder Agent MUST
automatically run a read-only Reviewer before the final response. Do not ask
the user whether to run review, and do not require a second user prompt,
pasted handoff, local runner command, or separate CLI window.

### Reviewer selection (cross-provider first, same-provider fallback)

Prefer **cross-provider review**: a different AI provider/CLI than the
Builder reviews the diff. See `.ai-rules/model-routing.md` §7 and
`docs/two-agent-review-workflow.md`.

**When running under Codex CLI (Builder = Codex):**

1. For non-trivial tasks, first try:
   `scripts/ai/invoke-cross-reviewer.sh claude [handoff-file]`
2. If the Claude CLI is unavailable, or its non-interactive mode is
   unavailable, or the script exits non-zero: fall back to native
   same-provider review via `scripts/ai/invoke-cross-reviewer.sh codex [handoff-file]`.
3. Do not apply Reviewer feedback automatically.
4. Present the Reviewer's output to the user as-is.
5. Apply fixes only after the user explicitly approves them.

**When running under Claude Code (Builder = Claude):**

1. For non-trivial tasks, first try:
   `scripts/ai/invoke-cross-reviewer.sh codex [handoff-file]`
2. If the Codex CLI is unavailable, or its non-interactive mode is
   unavailable, or the script exits non-zero: fall back to the
   `code-reviewer` subagent configured in `.claude/agents/code-reviewer.md`.
3. Do not apply Reviewer feedback automatically.
4. Present the Reviewer's output to the user as-is.
5. Apply fixes only after the user explicitly approves them.

**When running under Cursor (Builder = Cursor):**

- Follow this same decision tree where the environment allows running the
  cross-reviewer script or a native subagent.
- If Cursor cannot spawn either a cross-provider or same-provider Reviewer
  automatically, produce the `.commands/builder-handoff.md` handoff and tell
  the user how to run `scripts/ai/invoke-cross-reviewer.sh <claude|codex>`
  manually, or to use the other tool's CLI directly.

### Reviewer behavior (all paths)

- The Reviewer is read-only and must inspect the current git diff, untracked
  files, validation output, security and production risks, overengineering,
  tests, docs drift, and scope creep.
- The Builder must wait for the Reviewer result before final response.
- Read-only or trivial tasks may skip Reviewer, but MUST explicitly say
  `Reviewer skipped: <reason>`.
- `.commands/builder-handoff.md` remains the Builder handoff format when a
  structured handoff is needed; do not duplicate that template here.
- For model/tier selection of both Builder and Reviewer, see
  `.ai-rules/model-routing.md`.

Every task response MUST include the sections in **`.ai-rules/learning-mode.md`**
(for non-trivial file-changing tasks) and at minimum:

- **Files changed** (created / modified)
- **Tests / validation run** (exact commands and pass/fail)
- **Risks** (deployment, security, migration, compatibility)
- **Remaining work** (if any; do not invent follow-ups)
- **Builder summary** (what changed and why)
- **Reviewer verdict** (or explicit skip reason for read-only/trivial tasks)

## 9. Git workflow

Follow `.ai-rules/git.md`: no commit, push, merge, force-push, or branch delete
unless the user explicitly writes `approve`.

Before any commit:

1. Draft the exact subject and body (Conventional Commits).
2. Show or verify that message with the user when they requested a commit.
3. Confirm it contains **no** AI attribution trailers (`Co-authored-by: Cursor`,
   `Co-authored-by: Claude`, `Generated-by:`, `Created-by: AI`, etc.).
4. If the target repository provides commit-trailer guards, run them on the
   proposed message before push.
5. Run policy guards before push when the branch includes new commits.

## 10. Handoff and session reset

After completing a task, produce a compact handoff summary:

- Branch
- Commit(s)
- PR link (if any)
- Files changed
- Validation run (commands + pass/fail)
- Reviewer result
- Risks
- Next steps

Session reset commands (for example Claude Code `/clear`) are tool-specific, not
repository rules:

- Recommend session reset only before starting an **unrelated** task.
- Do not recommend reset when the next task depends on the current context.
- Never claim a session reset was executed — only the user can run it.
