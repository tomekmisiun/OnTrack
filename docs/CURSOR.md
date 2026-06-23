# Cursor

## What Cursor loads automatically

| File | When |
|------|------|
| `.cursor/rules/project.mdc` | Always (`alwaysApply: true`) |
| Other `.mdc` files | When open file path matches `globs` |

## Shared rules

`project.mdc` points to `.ai-rules/` as the binding source of truth. Cursor does
**not** automatically read every file under `.ai-rules/` — agents must follow
pointers in `project.mdc` and `agent-orchestration.md` to open relevant rules.

## Glob rules in this template

| Rule | Globs |
|------|-------|
| `backend.mdc` | `src/`, `app/`, `lib/`, `internal/`, `tests/` |
| `testing.mdc` | test directories and `*_test.*` patterns |
| `docker.mdc` | Dockerfile, compose files |
| `documentation.mdc` | README, `docs/` |
| `workflow.mdc` | `.git/**` |
| `security.mdc` | security/auth/config paths |

Customize globs when adopting into a repository with a different layout.

## Verify Cursor read the rules

1. Open a file matching a glob (e.g. `README.md`) and confirm the matching rule appears in Cursor rules UI.
2. Start a task; agent should cite `.ai-rules/agent-orchestration.md` and scope.
3. Run `make validate` to verify repository rule files and frontmatter.

## Subagent limitations

Cursor may not spawn Claude Code or Codex CLI as subagents. For Reviewer:

1. Try `scripts/ai/invoke-cross-reviewer.sh` in the integrated terminal if CLIs exist.
2. Otherwise use `.commands/builder-handoff.md` and run review in another tool.

## Fallback when Claude or Codex CLI unavailable

- Produce Builder handoff per `.commands/builder-handoff.md`
- User runs `scripts/ai/invoke-cross-reviewer.sh <provider>` manually
- Or uses `.commands/review-current-branch.md` in Cursor as same-provider review

See `docs/two-agent-review-workflow.md`.
