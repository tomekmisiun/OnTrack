# Learning Mode (Mentor Explanations)

Binding for **every non-trivial file-changing task**. Complements
`.ai-rules/agent-orchestration.md` §8 and `.ai-rules/review.md`.

Goal: explain changes like a **technical mentor** — precise, beginner-friendly,
grounded in the repository's actual code (not README claims alone).

## Before changing code

- Read architecture and onboarding docs defined by the target repository when
  unsure what is implemented.
- Do not mark features implemented unless verified in code, tests, or migrations.

## Required final response sections

For non-trivial file-changing tasks, the final response MUST include all of:

### Builder summary

One short paragraph: what changed and why (user goal → outcome).

### Reviewer verdict

Verdict from the read-only Reviewer, or `Reviewer skipped: <reason>`.

### Changed files

List every created/modified/deleted file.

### Why each file changed

One line per file — purpose of the edit, not a repeat of the diff.

### What the changed code does

Explain behavior in plain language (what happens at runtime after your change).

### What calls it

Upstream callers: routes, workers, tests, CLI, other services. Name concrete
functions or endpoints when known.

### What could break

Auth, migrations, concurrency, cache, worker jobs, API contract, backward
compatibility — only relevant risks.

### Validation run

Exact commands and PASS/FAIL. If skipped, say why.

### Manual verification steps

Concrete steps a human can run (HTTP request, test path, migration upgrade, log
check).

### Interview-defense explanation

2–5 sentences you could say in a technical interview: problem, approach,
trade-off, how tests/CI prove correctness. No buzzwords without meaning.

## Docs-only tasks

Use the same sections where applicable; omit code-specific subsections if N/A.
Still include validation run and manual verification.
