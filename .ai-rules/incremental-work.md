# Incremental Work

Implement changes as **thin vertical slices** with frequent validation.

## Rules

1. **One slice at a time** — e.g. schema → service → route → test, not all
   layers in one untested batch.
2. **Test after each slice** — run targeted tests for touched modules before
   full repository validation.
3. **Do not mix unrelated concerns** — no feature + refactor + unrelated docs in
   the same commit unless the user explicitly asked.
4. **Keep diffs reviewable** — prefer several small commits on a branch over one
   large unreadable diff (user still controls when to commit).
5. **Stop at scope boundary** — if you discover extra debt, note it; do not fix
   unless in scope.

## Suggested slice order (features)

1. Data model / migration (if applicable)
2. Request/response schemas or DTOs
3. Service or domain functions
4. Transport handler + permissions
5. Integration tests
6. Docs / tracking files

## Refactors

- Behavior-preserving refactors: run existing tests after each step.
- MUST NOT combine refactor with behavior change in the same slice.

## Validation cadence

Use the validation command defined by the target repository (see
`.ai-rules/validation.md`).

Documentation-only or AI-rules-only slices: run AI workflow validation when
workflow files change.
