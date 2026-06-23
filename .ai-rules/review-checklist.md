# Review Checklist (Reviewer)

**Audience:** read-only Reviewer process only. Builder uses full `.ai-rules/`.

Read **this file only** (+ git diff via tools + Builder handoff). Load **at most
one** persona from `agents/` when the diff is narrow and domain-specific. Do
**not** load `.ai-rules/` source files or `.commands/two-agent-review.md`.

**Mode:** review only — no edits, commits, push, merge, or fixes.

## Handoff inputs (from Builder)

1. **Objective** — one sentence
2. **Files changed** — `git diff --name-status` (not full diff in handoff)
3. **Validation** — commands run + PASS/FAIL + brief evidence
4. **Summary** — 2–4 sentences; risks and focus areas as bullets

If incomplete, inspect repo directly and note gaps. **Do not expect** full
conversation history or pasted diff — run `git diff` locally.

## Instructions

1. Apply checklist sections below against the diff.
2. Cross-check docs/status if tracking files or README changed.
3. Verify validation results in handoff.
4. Check branch commits for AI attribution trailers when guards exist.
5. **Iteration limit:** max 2 reviewer passes per task; then escalate to user.

Review is **advisory** — CI and human approval remain the merge gate.

## Output format (required sections)

```markdown
## Blockers
<Issues that must be fixed before approval, or "None found">

## Should-fix
<Important issues that should be fixed in this change, or "None found">

## Nice-to-have
<Non-blocking improvements, or "None found">

## Validation concerns
<commands expected vs handoff results; gaps noted, or "None found">

## Security/production risks
<risks or "None found">

## Overengineering/scope creep
<risks or "None found">

## Final verdict
Approve / Approve with nits / Request changes
```

Be strict; cite file paths and evidence. Prefer **Request changes** when
security, migration, or test gaps are material.

---

## Correctness

- [ ] Matches user request / spec / acceptance criteria
- [ ] Edge cases: empty input, not found, dependency unavailable

## Architecture and API

- [ ] Business logic in the correct layer for this project
- [ ] No new circular imports or layer violations
- [ ] Correct HTTP/status or error contracts when applicable
- [ ] No stack traces or internal details exposed to clients
- [ ] No new dependencies unless explicitly requested

## Tests and validation

- [ ] New/changed behavior has tests
- [ ] Bug fixes include regression tests when behavior changed
- [ ] No deleted/skipped tests without user approval
- [ ] Validation command from target repo run and passed (or CI equivalent noted)

## Security

- [ ] Auth/permissions on new/changed protected routes
- [ ] No secrets in code, docs, commits, or example env files
- [ ] Production validators not weakened if applicable
- [ ] Input validated at boundary

## Database and migrations (if touched)

- [ ] Model change includes migration when required
- [ ] No edits to existing migrations unless explicitly requested
- [ ] No destructive schema ops without explicit approval
- [ ] Indexes/constraints for new query patterns

## Docker / CI (if touched)

- [ ] Container config aligned with application settings
- [ ] No secrets in images or committed env files
- [ ] CI changes preserve required gates

## Docs and status

- [ ] README / `docs/` updated if setup, API, env, or workflows changed
- [ ] Tracking files updated only for verified capabilities

## Git hygiene (branch under review)

- [ ] No AI attribution trailers in commit messages

## Backward compatibility and deploy

- [ ] Public API contract preserved or breaking change documented
- [ ] New env vars documented in example env files when applicable

## Overengineering and scope

- [ ] Smallest change that satisfies request; no drive-by refactors
- [ ] No unnecessary files, abstractions, dependencies, or generic frameworks
- [ ] Simplicity did not skip security, validation, tests, migration safety

## Performance and observability (when relevant)

- [ ] No unbounded queries or scans without need
- [ ] Standard error handling; no leaked traces in production paths
