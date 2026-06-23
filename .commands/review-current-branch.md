# Command: Review Current Branch

Copy everything below the line into your agent chat.

---

You are reviewing the **current branch** before a PR.

**Base branch:** default branch (unless user specified otherwise)

**Instructions:**

1. Read `.ai-rules/review.md` and load personas from `agents/` as needed:
   - Backend → `agents/backend-reviewer.md`
   - Security → `agents/security-auditor.md`
   - Database → `agents/database-reviewer.md`
   - CI/Docker → `agents/devops-ci-reviewer.md`
2. Compare branch to base: `git diff <base>...HEAD`.
3. Check architecture, tests, security, migrations, docs/status consistency.
4. Run or recommend validation from `.ai-rules/validation.md`.
5. Verify commit messages on the branch contain no AI attribution trailers when guards exist.
6. Do not fix code unless the user asked for fixes — review first.

**Output format:**

```markdown
## Summary
## Findings (table with Severity | File | Issue | Recommendation)
## Validation (commands + results)
## Verdict (Approve / Approve with nits / Request changes)
```

Be strict; prefer evidence over assumptions.
