# Roadmap

**Last updated:** 2026-06-28

Active and planned work only. Completed milestones are listed under [Completed (reference)](#completed-reference). For confirmed debt with code evidence see [TECH_DEBT.md](./TECH_DEBT.md).

---

## P0 — Production stability

No open P0 items as of 2026-06-28.

---

## P1 — Operability

| ID | Problem | Proposed solution | Priority | Dependencies | Done when | Status |
|----|---------|-------------------|----------|--------------|-----------|--------|
| R-040 | Full catalog re-import on every deploy | Idempotent sync or import only when catalog version changes | P2 | Deploy scripts | Deploy without mandatory restore step for user FKs | **Open** (see [TD-003](./TECH_DEBT.md#td-003--catalog-import-on-every-deploy)) |

---

## P2 — Product and quality

| ID | Problem | Proposed solution | Priority | Dependencies | Done when | Status |
|----|---------|-------------------|----------|--------------|-----------|--------|
| R-041 | Export shopping-list totals may diverge from summary API | Contract test + align FE package math with backend `get_summary()` | P3 | — | Test green; no user-visible discrepancy | **Open** (see [TD-010](./TECH_DEBT.md#td-010--export-summary-package-math-parity)) |
| R-042 | Production metrics beyond Railway logs | Wire Prometheus scrape or hosted APM for API | P3 | Ops | Dashboards for latency/error rate in prod | **Open** (see [TD-009](./TECH_DEBT.md#td-009--grafanaprometheus-local-only)) |

---

## P3 — Nice to have

| ID | Problem | Proposed solution | Priority | Dependencies | Done when | Status |
|----|---------|-------------------|----------|--------------|-----------|--------|
| R-043 | Legacy `FLASK_SECRET_KEY` env name | Add `SESSION_SECRET_KEY` alias with backward-compatible read | P3 | — | Docs + config accept both names | **Open** (see [TD-005](./TECH_DEBT.md#td-005--legacy-env-var-names)) |
| R-044 | HttpOnly cookie auth in production | Re-evaluate enabling BFF after XSS review | P3 | Security sign-off | ADR 0001 updated or BFF enabled on staging | **Open** (see [ADR 0001](./adr/0001-bff-production-mode.md), [TD-001](./TECH_DEBT.md#td-001--jwt-in-localstorage)) |

---

## Cancelled / superseded

| Item | Reason |
|------|--------|
| Separate background worker service | Removed — see [ADR 0002](./adr/0002-background-worker.md) |
| Repo-root scraper service | Moved to `archive/scraper-legacy/` |
| Playwright visual screenshot regression | Removed — flaky, not requested |
| Playwright functional E2E | Removed — covered by contract tests, Vitest, CI build, deploy smoke |
| Playwright auth E2E CI job | Removed with Playwright — deploy HTTP smoke covers prod auth |

---

## Completed (reference)

| ID | Summary | Evidence |
|----|---------|----------|
| R-001 | Catalog FK stash/restore around deploy import | #154 |
| R-002 | E2E auth stability (historical Playwright era) | #151 |
| R-003 | Backend integration CI green | #153 |
| R-010 | Documentation reset + minimal `docs/` set | #163 |
| R-011 | Scheduled production auth smoke workflow | `production-smoke.yml` |
| R-012 | Password reset email + register/login UI | #168, #169 |
| R-020 | UI locale vs product market separation | #150, ADR 0003 |
| R-021 | BFF production decision recorded | ADR 0001 |
| R-030 | Railway staging environment + CI gate | `ci.yml` |
| R-031 | Optional Sentry integration | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` |

---

## How to update

1. Verify feature status in code before marking Done
2. Add new rows with problem → solution → acceptance criteria
3. Move finished items to **Completed (reference)** — do not leave them in active sections
4. Link overlapping [TECH_DEBT.md](./TECH_DEBT.md) entries by ID instead of duplicating detail
