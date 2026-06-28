# Cursor

Tool-specific notes. Shared workflow: [workflows.md](./workflows.md).

## What Cursor loads

| File | When |
|------|------|
| `.cursor/rules/project.mdc` | Always (`alwaysApply: true`) |
| Other `.mdc` files | When open file path matches `globs` |

`project.mdc` points to `.ai-rules/` as binding source. Agents must follow pointers in `agent-orchestration.md` to open relevant rules.

## Glob rules

| Rule | Globs |
|------|-------|
| `backend.mdc` | `backend/`, tests |
| `testing.mdc` | test directories |
| `docker.mdc` | Dockerfile, compose |
| `documentation.mdc` | README, `docs/` |
| `workflow.mdc` | `.git/**` |
| `security.mdc` | auth/config paths |

## Reviewer limitations

Cursor may not spawn Claude Code or Codex CLI as subagents. For Reviewer:

1. Try `scripts/ai/invoke-cross-reviewer.sh` in the integrated terminal if CLIs exist.
2. Otherwise use `.commands/builder-handoff.md` and run review in another tool.

See [workflows.md](./workflows.md#builder--reviewer).

## Verify rules loaded

1. Open a file matching a glob and confirm the rule appears in Cursor rules UI.
2. Run `make validate` to verify repository rule files and frontmatter.
