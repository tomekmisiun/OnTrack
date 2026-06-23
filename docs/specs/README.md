# Feature Specs

Store non-trivial feature specs as `docs/specs/<slug>.md`.

## Template sections

1. Objective
2. Problem / user story
3. Requirements (numbered, testable)
4. Non-goals
5. Acceptance criteria
6. Impacted files
7. Risks
8. Verification plan (commands from `.ai-rules/validation.md`)
9. Open questions (if blocking)

## Rules

- Align with `.ai-rules/spec-driven-development.md`
- Do not implement in the spec task unless requested
- Link spec from PR description when used

Use `.commands/spec.md` to generate a spec in chat.
