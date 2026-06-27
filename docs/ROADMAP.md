# Roadmap

**Last updated:** 2026-06-27

Active plans only. Completed work is removed or marked done. For technical debt items see [TECH_DEBT.md](./TECH_DEBT.md).

---

## P0 — Production stability

| ID | Problem | Proposed solution | Priority | Dependencies | Done when | Status |
|----|---------|-------------------|----------|--------------|-----------|--------|
| R-001 | Catalog import on deploy can break user meal-plan FKs | Stash/restore user refs around `import_catalog` | P0 | Migration `b1c2d3e4f5a6` | Pre-deploy completes; users keep favorites/plans after deploy | **Done** (#154) |
| R-002 | Flaky e2e-auth logout | Centralized logout helper + longer timeouts | P0 | Playwright | `frontend-next-e2e-auth` stable on CI | **Done** (#151) |
| R-003 | Backend integration CI failures | ORM/schema parity + migration chain fix | P0 | Postgres CI service | `backend-integration` green | **Done** (#153) |

---

## P1 — Documentation and operability

| ID | Problem | Proposed solution | Priority | Dependencies | Done when | Status |
|----|---------|-------------------|----------|--------------|-----------|--------|
| R-010 | Scattered, stale Markdown | Minimal `docs/` set + audit trail | P1 | — | This audit merged; links valid | **Done** (#163) |
| R-011 | No automated prod auth smoke in CI | Scheduled GitHub workflow + manual dispatch (`production-smoke.yml`) | P1 | Ops secrets | Register/login synthetic check outside PR CI | **Done** |
| R-012 | Password reset without email | SMTP provider + templated email + rate limit | P1 | Provider choice | User receives reset link by email | **Done** (#168, #169 email register/login) |

---

## P2 — Product and UX

| ID | Problem | Proposed solution | Priority | Dependencies | Done when | Status |
|----|---------|-------------------|----------|--------------|-----------|--------|
| R-020 | UI locale vs market separation was implicit | Separate `ui_locale` and `market_code` end-to-end | P2 | Catalog model | Users can pick UI language independently of product market | **Done** (#150, ADR 0003) |
| R-021 | BFF auth not used in production | Evaluate HttpOnly cookie auth for XSS reduction | P2 | Security review | Decision recorded; enabled or explicitly rejected | **Done** ([ADR 0001](./adr/0001-bff-production-mode.md)) |
| R-022 | Visual regression not gated | Add optional CI job or manual release checklist | P2 | Playwright visual suite | Documented process or CI job | **Done** (`visual-regression.yml` + [DEPLOYMENT.md](./DEPLOYMENT.md)) |

---

## P3 — Nice to have

| ID | Problem | Proposed solution | Priority | Dependencies | Done when | Status |
|----|---------|-------------------|----------|--------------|-----------|--------|
| R-030 | Dedicated staging environment | Second Railway project mirroring prod | P3 | Ops budget | Staging URL documented in DEPLOYMENT | **Done** (Railway env `staging` + CI gate in `ci.yml`) |
| R-031 | Error tracking | Sentry or similar for frontend + API | P3 | Provider | Errors visible in dashboard | **Done** (optional `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`) |

---

## Cancelled / superseded

| Item | Reason |
|------|--------|
| Separate background worker service | Removed — see [ADR 0002](./adr/0002-background-worker.md) |
| Repo-root scraper service | Moved to `archive/scraper-legacy/` |

---

## How to update

1. Verify feature status in code before moving items to Done
2. Add new rows with problem → solution → criteria
3. Move cancelled items to table above with reason
4. Do not duplicate TECH_DEBT entries — link by ID where overlap exists
