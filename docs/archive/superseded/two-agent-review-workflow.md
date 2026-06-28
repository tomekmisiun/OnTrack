> [!WARNING]
> Dokument archiwalny. Nie stanowi aktualnego źródła prawdy.
> Aktualna dokumentacja: [workflows.md](../../development/ai/workflows.md).

# Two-Agent Review Workflow

Builder implements; Reviewer inspects read-only before the Builder's final response.

## Principles

- Cross-provider review preferred (different CLI than Builder).
- Same-provider fallback when cross-provider CLI is unavailable.
- Reviewer output uses `.ai-rules/review-checklist.md` sections.
- Builder does not apply Reviewer fixes without explicit user approval.

## Paths by Builder tool

| Builder | First choice | Fallback |
|---------|--------------|----------|
| Codex CLI | `scripts/ai/invoke-cross-reviewer.sh claude` | `scripts/ai/invoke-cross-reviewer.sh codex` |
| Claude Code | `scripts/ai/invoke-cross-reviewer.sh codex` | `.claude/agents/code-reviewer.md` subagent |
| Cursor | `scripts/ai/invoke-cross-reviewer.sh` if runnable | `.commands/builder-handoff.md` + manual CLI |

## Verification status

Cross-provider review requires locally installed CLIs. The validation script does
**not** invoke them. Test manually when adopting:

```bash
scripts/ai/invoke-cross-reviewer.sh --help
# When installed and on PATH:
# scripts/ai/invoke-cross-reviewer.sh codex
```

## Approve gate

No commit, push, or merge without explicit user `approve` (see `.ai-rules/git.md`).

## References

- `.ai-rules/agent-orchestration.md` §8
- `.ai-rules/model-routing.md`
- `docs/CROSS_PROVIDER_REVIEW.md`
