# Roadmap

**Last updated:** 2026-06-28

Active and planned work only. Completed milestones: [archive/completed-plans/roadmap-completed.md](../archive/completed-plans/roadmap-completed.md). For confirmed debt see [tech-debt.md](./tech-debt.md).

---

## P0 — Production stability

No open P0 items as of 2026-06-28.

---

## P1 — Operability

| ID | Problem | Proposed solution | Priority | Done when | Status |
|----|---------|-------------------|----------|-----------|--------|
| R-040 | Full catalog re-import on every deploy | Idempotent sync or import only when catalog version changes | P2 | Deploy without mandatory restore step for user FKs | **Open** ([TD-003](./tech-debt.md#td-003--catalog-import-on-every-deploy)) |

---

## P2 — Product and quality

| ID | Problem | Proposed solution | Priority | Done when | Status |
|----|---------|-------------------|----------|-----------|--------|
| R-041 | Export shopping-list totals may diverge from summary API | Contract test + align FE package math with backend `get_summary()` | P3 | No user-visible discrepancy | **Open** ([TD-010](./tech-debt.md#td-010--export-summary-package-math-parity)) |
| R-042 | Production metrics beyond Railway logs | Wire Prometheus scrape or hosted APM for API | P3 | Dashboards for latency/error rate in prod | **Open** ([TD-009](./tech-debt.md#td-009--grafanaprometheus-local-only)) |

---

## P3 — Nice to have

| ID | Problem | Proposed solution | Priority | Done when | Status |
|----|---------|-------------------|----------|-----------|--------|
| R-043 | Legacy `FLASK_SECRET_KEY` env name | Add `SESSION_SECRET_KEY` alias with backward-compatible read | P3 | Docs + config accept both names | **Open** ([TD-005](./tech-debt.md#td-005--legacy-env-var-names)) |
| R-044 | HttpOnly cookie auth in production | Re-evaluate enabling BFF after XSS review | P3 | ADR 0001 updated or BFF enabled on staging | **Open** ([ADR 0001](../adr/0001-bff-production-mode.md), [TD-001](./tech-debt.md#td-001--jwt-in-localstorage)) |

---

## Cancelled / superseded

| Item | Reason |
|------|--------|
| Separate background worker service | Removed — [ADR 0002](../adr/0002-background-worker.md) |
| Repo-root scraper service | Moved to `archive/scraper-legacy/` |
| Playwright visual / functional E2E | Removed — Vitest, contract tests, deploy smoke |

---

## How to update

1. Verify feature status in code before marking done
2. Move finished items to [roadmap-completed.md](../archive/completed-plans/roadmap-completed.md)
3. Link overlapping [tech-debt.md](./tech-debt.md) entries by ID
