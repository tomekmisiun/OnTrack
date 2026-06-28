# Model Routing Policy

## 1. Purpose

AI tooling can use multiple models of different cost and capability. The goal
is to **preserve review quality and safety while avoiding unnecessary cost**:
cheaper models for mechanical or low-risk work; stronger models reserved for
security, data, distributed systems, and final pre-merge review.

This is **guidance for model/agent selection**, not a binding gate enforced by
CI. Static validation only checks that this file exists and is referenced; it
does not verify which model was actually used.

## 2. Model tiers

| Tier | Description |
|------|-------------|
| `cheap_fast` | Smallest/cheapest available model. Mechanical edits, formatting, docs. |
| `standard_builder` | Default mid-tier model for ordinary implementation work. |
| `strong_builder` | Capable model for high-risk implementation: security, migrations, infra. |
| `strong_reviewer` | Reviewer at least as capable as the Builder for non-trivial changes. |
| `max_risk_review` | Strongest available model for high-risk diffs or large refactors. |

## 3. Task classification → recommended tier

| Task | Recommended tier |
|------|------------------|
| Docs-only typo or index update | `cheap_fast` |
| Mechanical rename, small config-only change | `cheap_fast` or `standard_builder` |
| Normal application feature change | `standard_builder` |
| Multi-file feature | `standard_builder` + `strong_reviewer` |
| Auth, secrets, security-sensitive changes | `strong_builder` + `strong_reviewer` |
| DB migration or schema change | `strong_builder` + `strong_reviewer` |
| Data isolation / multi-tenant boundaries | `strong_builder` + `strong_reviewer` |
| Workers, queues, idempotency | `strong_builder` + `strong_reviewer` |
| Docker, CI/CD, deployment | `strong_builder` + `strong_reviewer` |
| Large architecture refactor | `strong_builder` + `max_risk_review` |

## 4. Provider selection

Actual model names MUST be selected through **local CLI configuration** or
environment variables. Do not assume a specific model is available on every plan.

Configure reviewer models via:

- `AI_REVIEW_MODEL` — absolute override for the current review run
- `CLAUDE_REVIEW_MODEL` — Claude-specific override
- `CODEX_REVIEW_MODEL` — Codex-specific override
- `AI_REVIEW_TIER` — abstract tier hint (defaults to `strong_reviewer`)

See `scripts/ai/invoke-cross-reviewer.sh` and `docs/development/ai/workflows.md`.

## 5. Escalation rules

Escalate to at least `strong_builder` and `strong_reviewer` or `max_risk_review`
if the diff touches migrations, auth/security, data isolation, workers/queues,
Docker/CI, production configuration, or deployment paths.

## 6. De-escalation rules

Use `cheap_fast` only when the change is docs-only, touches no application code,
and has no security, migration, worker, Docker, or CI impact.

## 7. Reviewer rule

- The Reviewer should normally be **at least the same tier** as the Builder.
- For high-risk tasks, the Reviewer should be **stronger** than the Builder.
- **Cross-provider review is preferred** — see `scripts/ai/invoke-cross-reviewer.sh`
  and `.ai-rules/agent-orchestration.md` §8.
- If cross-provider review is unavailable, run a same-provider read-only
  Reviewer using the fallback documented for each tool.

## 8. Diff-first cost control

Reviewers MUST:

1. Start with `git status`, `git diff --stat`, and `git diff`.
2. Read only files the diff touches, plus targeted call sites/tests when needed.
3. Load **at most one** persona from `agents/` when domain-specific.
4. Avoid loading the full `.ai-rules/` tree during review.

## 9. Concrete model selection

`scripts/ai/invoke-cross-reviewer.sh` resolves models in this order:

1. `AI_REVIEW_MODEL`
2. `CLAUDE_REVIEW_MODEL` or `CODEX_REVIEW_MODEL` (by provider)
3. CLI default model (no `-m` / `--model` flag passed)

Set `AI_REVIEW_TIER` to document intent; configure concrete model names through
environment variables or local CLI defaults. Update `docs/development/ai/workflows.md`
when your team standardizes reviewer models.
