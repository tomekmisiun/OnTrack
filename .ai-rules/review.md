# Pre-Merge Review

Use before opening or merging a PR. Optional deep dives: personas in `agents/`.

**Reviewer:** read `.ai-rules/review-checklist.md` + diff — not the full
`.ai-rules/` corpus. This file is the detailed reference for humans and Builder.

## Review iteration limit

- Max **2** reviewer → fix → reviewer cycles per task.
- After cycle 2, if blockers remain: **escalate to the user** — do not loop
  automatically.

## Checklist summary

### Correctness
- Behavior matches spec / user request and acceptance criteria
- Edge cases handled

### Architecture
- Logic in the correct layer; no layer violations

### Tests
- New/changed behavior has tests
- Validation command from target repo passes

### Security
- Auth and permissions on protected routes
- No secrets in code or committed env files

### Database / migrations (if applicable)
- Migrations present when required
- No destructive migration without approval

### Docs / status
- README / docs updated when behavior or setup changes

### Git / commit hygiene
- No AI attribution trailers on the branch

### Deployment risk
- Migrations, new dependencies, or env vars documented

## Output format (review tasks)

```markdown
## Summary
## Findings
| Severity | File | Issue | Recommendation |
## Validation
## Verdict
```

Use `.commands/review-current-branch.md` for a copy-paste review prompt.
