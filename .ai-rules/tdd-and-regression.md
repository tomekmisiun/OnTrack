# TDD and Regression

Complements `.ai-rules/testing.md` with **workflow** for bugs and new behavior.

## Bug fixes

When practical:

1. **Reproduce** — add a failing test that asserts correct behavior.
2. **Verify failure** — run targeted tests; confirm expected failure.
3. **Fix minimally** — smallest change in the correct layer.
4. **Prove fix** — same test passes; run related module tests.
5. **Regression guard** — test stays in suite permanently.

Skip failing-test-first only when reproduction is prohibitively expensive;
document why and add the strongest feasible test.

## New behavior

| Area | Test expectation |
|------|------------------|
| New/changed route or handler | Integration test; status + response contract |
| Service or domain logic | Unit or service-level test |
| Auth / permissions | Positive and denial cases |
| Data isolation | Cross-scope denial when applicable |
| Migrations | Upgrade path; downgrade when destructive |
| Workers / queue | Handler test; failure paths when relevant |
| Security / rate limits | Appropriate denial responses |
| Config validators | Tests for production guard behavior |

## Must not

- Delete or skip tests to green CI without explicit user approval.
- Weaken assertions to pass.
- Add tests that only assert mocks with no behavior claim.

## Commands

Use the test and validation commands defined by the target repository (see
`.ai-rules/validation.md`).
