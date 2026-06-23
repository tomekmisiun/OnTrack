# Codex CLI

## Entry point

Codex CLI loads **`AGENTS.md`**. Treat it as an index to `.ai-rules/`.

## Shared rule loading

Same workflow as Claude Code:

1. `AGENTS.md` → `.ai-rules/agent-orchestration.md`
2. Task-specific rules from `.ai-rules/context-map.md`

## Review workflow

After non-trivial file changes:

```bash
scripts/ai/invoke-cross-reviewer.sh claude
```

Fallback:

```bash
scripts/ai/invoke-cross-reviewer.sh codex
```

## Cross-provider review

See `docs/CROSS_PROVIDER_REVIEW.md` for environment variables and safety constraints.

## Fallback behavior

| Step | Action |
|------|--------|
| 1 | Cross-provider Claude review (`claude -p`) |
| 2 | Native `codex review --uncommitted` (read-only sandbox) |
| 3 | Manual review prompt `.commands/review-current-branch.md` |

## Repository validation

```bash
make validate
```

Static only — does not call Codex.

## Consumer repositories

Replace placeholder validation commands in `.ai-rules/validation.md` when
adopting into an application repo.
