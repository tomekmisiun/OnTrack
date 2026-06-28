# AI workflows

Canonical guide for agents working in this repository. Tool-specific notes: [claude-code.md](./claude-code.md), [codex-cli.md](./codex-cli.md), [cursor.md](./cursor.md).

---

## Start here

1. `.ai-rules/agent-orchestration.md` — classify task, scope, validation, review
2. `.ai-rules/context-map.md` — files to read by task type
3. `.ai-rules/anti-overengineering.md` — complexity check

Entry indexes: [AGENTS.md](../../../AGENTS.md) (Codex), [CLAUDE.md](../../../CLAUDE.md) (Claude Code), [`.cursor/rules/project.mdc`](../../../.cursor/rules/project.mdc) (Cursor).

---

## Builder / Reviewer

Builder implements; Reviewer inspects read-only before the Builder's final response.

### Principles

- Cross-provider review preferred (different CLI than Builder).
- Same-provider fallback when cross-provider CLI is unavailable.
- Reviewer output uses `.ai-rules/review-checklist.md` sections.
- Builder does not apply Reviewer fixes without explicit user approval.

### Paths by Builder tool

| Builder | First choice | Fallback |
|---------|--------------|----------|
| Codex CLI | `scripts/ai/invoke-cross-reviewer.sh claude` | `scripts/ai/invoke-cross-reviewer.sh codex` |
| Claude Code | `scripts/ai/invoke-cross-reviewer.sh codex` | `.claude/agents/code-reviewer.md` subagent |
| Cursor | `scripts/ai/invoke-cross-reviewer.sh` if runnable | `.commands/builder-handoff.md` + manual CLI |

Handoff format: [`.commands/builder-handoff.md`](../../../.commands/builder-handoff.md)

---

## Cross-provider review

Script: `scripts/ai/invoke-cross-reviewer.sh`

```bash
scripts/ai/invoke-cross-reviewer.sh --help
scripts/ai/invoke-cross-reviewer.sh claude [handoff-file]
scripts/ai/invoke-cross-reviewer.sh codex [handoff-file]
```

| Provider | CLI | Mode |
|----------|-----|------|
| `claude` | Claude Code CLI on PATH | `claude -p --permission-mode plan` |
| `codex` | Codex CLI on PATH | `codex -s read-only -a never review --uncommitted` |

If the chosen CLI is not installed, the script exits `1` with a message to use fallbacks in `.ai-rules/agent-orchestration.md`. It never silently switches provider.

### Model configuration

| Variable | Purpose |
|----------|---------|
| `AI_REVIEW_MODEL` | Absolute override |
| `CLAUDE_REVIEW_MODEL` | Claude reviewer override |
| `CODEX_REVIEW_MODEL` | Codex reviewer override |
| `AI_REVIEW_TIER` | Tier hint (`strong_reviewer` default) |

Optional repository-local file (gitignored): `.ai-review.env` — see `examples/ai-review.env.example`

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | Review completed |
| 1 | CLI missing, review failed, or incomplete Claude output |
| 2 | Invalid arguments |

Cross-provider review requires locally installed CLIs. `make validate` does **not** invoke them.

---

## Branch workflow, commits, and approval

- Follow `.ai-rules/git.md` — no push/merge without explicit user `approve`.
- Run `make validate` before handoff; full test commands in `.ai-rules/validation.md`.
- Final Builder response includes summary + Reviewer verdict (see `.ai-rules/agent-orchestration.md` §8).

---

## Optional commands and personas

| Command | Purpose |
|---------|---------|
| `.commands/spec.md` | Write a feature spec |
| `.commands/plan.md` | Break work into task cards |
| `.commands/review-current-branch.md` | Pre-PR branch review |
| `.commands/security-audit.md` | Security-focused audit |
| `.commands/two-agent-review.md` | Human index for Reviewer |

| Persona | Use when |
|---------|----------|
| `agents/backend-reviewer.md` | Handler/service/API changes |
| `agents/database-reviewer.md` | Models/migrations |
| `agents/security-auditor.md` | Auth, secrets, uploads |
| `agents/devops-ci-reviewer.md` | Docker, CI, deploy |

---

## Validation

```bash
make validate
```

Does not invoke external AI CLIs.
