# AI Workflows

Index of how agents work in this repository.

## Start here

1. `.ai-rules/agent-orchestration.md` — classify task, scope, validation, review
2. `.ai-rules/context-map.md` — files to read by task type
3. `.ai-rules/anti-overengineering.md` — complexity check

## Builder / Reviewer

- `docs/two-agent-review-workflow.md` — cross-provider review and fallbacks
- `.commands/builder-handoff.md` — structured handoff format
- `.ai-rules/review-checklist.md` — Reviewer output format

## Commands (optional prompts)

| Command | Purpose |
|---------|---------|
| `.commands/spec.md` | Write a feature spec |
| `.commands/plan.md` | Break work into task cards |
| `.commands/review-current-branch.md` | Pre-PR branch review |
| `.commands/security-audit.md` | Security-focused audit |
| `.commands/two-agent-review.md` | Human index for Reviewer |

## Personas (optional)

| Persona | Use when |
|---------|----------|
| `agents/backend-reviewer.md` | Handler/service/API changes |
| `agents/database-reviewer.md` | Models/migrations |
| `agents/security-auditor.md` | Auth, secrets, uploads |
| `agents/devops-ci-reviewer.md` | Docker, CI, deploy |

## Validation

```bash
make validate
```

## Tool entry points

- Cursor: `.cursor/rules/project.mdc`
- Claude Code: `CLAUDE.md`
- Codex CLI: `AGENTS.md`
