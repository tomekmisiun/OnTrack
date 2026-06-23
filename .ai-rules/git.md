# Git Rules

Feature branch workflow with explicit user approval for remote changes.

## Branching

- One task equals one branch unless the user explicitly requests otherwise.
- MUST NOT do feature work directly on the default branch unless the user
  explicitly requested it.
- Builder may create or use a dedicated feature branch before non-trivial work.

## Commits

- MUST NOT commit failing tests, secrets, `.env`, caches, virtual environments,
  local database files, or generated junk.
- MUST NOT commit automatically unless the user explicitly writes `approve`.
- After `approve`, commit only according to the rest of these git safety rules.
- Use Conventional Commits with a short, focused subject.

### No AI attribution in commit messages

- MUST NOT include AI tool attribution trailers in commit messages — ever.
- Forbidden trailers include (non-exhaustive):
  - `Co-authored-by: Cursor <cursoragent@cursor.com>`
  - `Co-authored-by: Claude` / `Co-authored-by: Codex` / similar agent lines
  - `Authored-by:` lines naming Cursor, Claude, Codex, OpenAI, Anthropic, or
    GitHub Copilot
  - `Generated-by:` / `Created-by: AI` / any similar AI attribution metadata
- Commit messages MUST list human authors only. AI assistants are tools, not
  co-authors.
- **Before committing**, the agent MUST show or verify the exact commit message
  (subject + body) that will be recorded.
- If the target repository provides trailer guards, run them before push.

## Push and merge

- MUST NOT push, merge, force-push, or delete branches unless the user
  explicitly writes `approve`.
- After `approve`, push, merge, or delete branches only according to the rest of
  these git safety rules.
- Before merge, show changed files, validation results, and a short summary.

## Auto-merge

- Repository-level auto-merge must already be enabled in host settings when
  used. Agents MUST NOT change repository settings to enable it.
- The agent MAY enable auto-merge for a PR only when **all** of the following
  hold:
  - the branch is pushed and the PR exists,
  - a local validation summary has been provided to the user,
  - Reviewer feedback has been addressed (or explicitly waived by the user),
  - the user explicitly asks for auto-merge, or project rules explicitly allow
    it for this change.
- MUST NOT enable auto-merge if local validation failed or unresolved risks
  remain.
- MUST NOT bypass branch protection or merge directly to the default branch.
