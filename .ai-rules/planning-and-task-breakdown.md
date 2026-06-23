# Planning and Task Breakdown

Break non-trivial work into **small, verifiable tasks**. One task should fit one
focused PR when possible.

## Task card format

Each task MUST include:

| Field | Content |
|-------|---------|
| **Title** | Imperative, specific |
| **Scope** | What changes; what is excluded |
| **Acceptance criteria** | Tests, behavior, docs that prove done |
| **Likely files** | Paths under application, test, migration, and docs dirs |
| **Validation** | Command defined by target repo (see `.ai-rules/validation.md`) |
| **Dependencies** | Prior tasks, migrations, env flags |
| **Rollback / safety** | Migration downgrade, feature flag, deploy note (if relevant) |

## Ordering

1. Schema / migration (if needed) before dependent logic
2. Service or domain logic before transport wiring
3. Tests with or immediately after each slice
4. Docs and tracking files in the **same PR** as the code they describe

## Backlog and tech debt

- Pick the next item from the executable backlog defined by the target
  repository unless the user specifies otherwise.
- Mark debt items done only after verification.
- Do not batch unrelated backlog items in one PR.

## Task sizing

- One PR represents one logical change.
- Unrelated changes MUST NOT be bundled into the same PR.
- Always separate when unrelated: migrations, auth, CI, Docker, security rules.

## Estimation hint

| Size | Guideline |
|------|-----------|
| S | One file, one test file, no migration |
| M | Several files, one migration, docs touch |
| L | Cross-cutting; split into multiple task cards |

Use `.commands/plan.md` to generate task cards from a spec or backlog item.
