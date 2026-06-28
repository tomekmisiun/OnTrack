> [!WARNING]
> Dokument archiwalny. Nie stanowi aktualnego źródła prawdy.
> Aktualna dokumentacja: [workflows.md](../../development/ai/workflows.md).

# Cross-Provider Review

Optional script: `scripts/ai/invoke-cross-reviewer.sh`

## Usage

```bash
scripts/ai/invoke-cross-reviewer.sh --help
scripts/ai/invoke-cross-reviewer.sh claude [handoff-file]
scripts/ai/invoke-cross-reviewer.sh codex [handoff-file]
```

## Requirements

| Provider | CLI | Mode |
|----------|-----|------|
| `claude` | Claude Code CLI on PATH | `claude -p --permission-mode plan` |
| `codex` | Codex CLI on PATH | `codex -s read-only -a never review --uncommitted` |

## Missing executables

If the chosen CLI is not installed, the script exits `1` with a message to use
fallbacks in `.ai-rules/agent-orchestration.md`. It never silently switches provider.

## Model configuration

No hardcoded model IDs in active rules. Configure via:

| Variable | Purpose |
|----------|---------|
| `AI_REVIEW_MODEL` | Absolute override |
| `CLAUDE_REVIEW_MODEL` | Claude reviewer override |
| `CODEX_REVIEW_MODEL` | Codex reviewer override |
| `AI_REVIEW_TIER` | Tier hint (`strong_reviewer` default) |

Optional repository-local file (gitignored): `.ai-review.env`  
Example: `examples/ai-review.env.example`

## Repository-specific reviewer commands

Teams may wrap the script in a Makefile target:

```makefile
review-cross:
	bash scripts/ai/invoke-cross-reviewer.sh codex
```

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Review completed |
| 1 | CLI missing, review failed, or incomplete Claude output |
| 2 | Invalid arguments |

## Safety

- Read-only review; no destructive commands in the script
- No automatic provider selection
- Static validation does not invoke this script

## Documentation

- `.ai-rules/model-routing.md`
- `docs/two-agent-review-workflow.md`
