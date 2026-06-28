# Codex CLI

Tool-specific notes. Shared workflow: [workflows.md](./workflows.md).

## Entry point

Codex CLI loads **`AGENTS.md`** — an index to `.ai-rules/`.

## Rule loading

1. `AGENTS.md` → `.ai-rules/agent-orchestration.md`
2. Task-specific rules from `.ai-rules/context-map.md`

## Review

After non-trivial file changes:

```bash
scripts/ai/invoke-cross-reviewer.sh claude
```

Fallback: `scripts/ai/invoke-cross-reviewer.sh codex`, then `.commands/review-current-branch.md`.

See [workflows.md](./workflows.md#cross-provider-review) for environment variables and exit codes.

## Validation

```bash
make validate
```

Static only — does not call Codex.
