# Claude Code

Tool-specific notes. Shared workflow: [workflows.md](./workflows.md).

## Entry point

Claude Code loads **`CLAUDE.md`** at session start — an index to `.ai-rules/`, not a replacement for binding rules.

## Rule loading

1. `CLAUDE.md` → `.ai-rules/agent-orchestration.md` → `.ai-rules/context-map.md`
2. Open additional `.ai-rules/` files per task type

## Review

After non-trivial changes, run cross-provider review:

```bash
scripts/ai/invoke-cross-reviewer.sh codex
```

Fallback: `.claude/agents/code-reviewer.md` subagent, then `.commands/review-current-branch.md`.

Configure models via `AI_REVIEW_MODEL`, `CODEX_REVIEW_MODEL` — see [workflows.md](./workflows.md#cross-provider-review).

## Safety

- Reviewer subagent is read-only (no edits, commit, push).
- Push/merge requires explicit user `approve` per `.ai-rules/git.md`.
