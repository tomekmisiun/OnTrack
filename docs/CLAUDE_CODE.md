# Claude Code

## Entry point

Claude Code loads **`CLAUDE.md`** at session start. It indexes `.ai-rules/` and
workflow docs — it does not replace reading binding rules for each task.

## Shared rule loading

1. `CLAUDE.md` → `.ai-rules/agent-orchestration.md` → `.ai-rules/context-map.md`
2. Open additional `.ai-rules/` files per task type
3. Do not duplicate rule bodies in `CLAUDE.md`

## Custom reviewer

Native fallback subagent: **`.claude/agents/code-reviewer.md`**

Used when `scripts/ai/invoke-cross-reviewer.sh codex` fails or Codex is not installed.

## Cross-provider review

After non-trivial changes, Builder should run:

```bash
scripts/ai/invoke-cross-reviewer.sh codex
```

Configure models via `AI_REVIEW_MODEL`, `CODEX_REVIEW_MODEL`, or CLI defaults.
See `docs/CROSS_PROVIDER_REVIEW.md`.

## Fallback behavior

| Step | Action |
|------|--------|
| 1 | Cross-provider Codex review |
| 2 | `code-reviewer` subagent |
| 3 | User manual review via `.commands/review-current-branch.md` |

## Permissions and safety

- Reviewer subagent is read-only (no edits, commit, push).
- No credentials or local Claude settings are stored in this repository.
- Push/merge requires explicit user `approve` per `.ai-rules/git.md`.

## Validation

```bash
make validate
```

Does not invoke Claude Code.
