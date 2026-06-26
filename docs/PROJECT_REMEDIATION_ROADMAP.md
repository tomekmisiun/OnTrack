# OnTrack — Project Remediation Roadmap

**Based on:** [`docs/audits/PROJECT_CURRENT_STATE_AUDIT_2026-06-26.md`](audits/PROJECT_CURRENT_STATE_AUDIT_2026-06-26.md)  
**Baseline commit:** `88aa1b9f1736a0f439bfd1c3124288efd29aa52b`  
**Created:** 2026-06-26  

One task = one branch = one PR. Implementation, tests, and doc updates for a given problem belong in the same task.

---

## Priority overview

| Priority | Tasks | Theme |
|----------|-------|-------|
| P0 | 2 | Doc source of truth, README factual errors |
| P1 | 5 | Worker/BFF decisions, auth docs, deploy runbook sync |
| P2 | 6 | Observability scope, CI docs, env vars, API contract index |
| P3 | 4 | Portfolio polish, archive hygiene, optional Grafana |

**Total:** 6 epics, **17 tasks** (epics without evidence were omitted).

---

## Epic 1 — Documentation source of truth

Establish one current audit and archive stale reports without losing history.

### DOC-001

```
ID: DOC-001
Nazwa: Point README and AGENTS to current audit
Priorytet: P0
Proponowany branch: docs/readme-audit-badge-and-index
Problem: README badges and "start here" link still reference FULL_PROJECT_AUDIT (2026-05-26) with stale claims (password reset, metrics, CRA).
Dowód: README lines 14–15, 790–791; audit §5, §6 C14.
Zakres: Update audit badge URL, documentation table, project status pointer to PROJECT_CURRENT_STATE_AUDIT_2026-06-26.md. Add one-line note that May 2026 audits are archived.
Poza zakresem: Full README rewrite; code changes.
Pliki prawdopodobnie objęte zmianą: README.md, AGENTS.md (optional index line only)
Kroki implementacji:
  1. Replace Technical Audit badge target.
  2. Update Documentation section table.
  3. Add link to PROJECT_REMEDIATION_ROADMAP.md.
Acceptance criteria:
  - No README link to FULL_PROJECT_AUDIT as "latest consolidated assessment".
  - Link to June 2026 audit works.
Testy: Manual link check; rg for stale badge paths.
Walidacja: rg -n "FULL_PROJECT_AUDIT" README.md → only historical mention if any.
Ryzyka: Broken links if archive moves not merged first.
Rollback: Revert README commit.
Zależności: DOC-002 (archive moves) — can be same PR if batched carefully.
Dokumentacja do aktualizacji: README.md
```

### DOC-002

```
ID: DOC-002
Nazwa: Archive superseded audit and migration reports
Priorytet: P0
Proponowany branch: docs/archive-stale-audits
Problem: 15+ docs describe Flask, CRA, scraper-at-root, or pre-remediation state; confuse onboarding.
Dowód: Audit §7 cleanup table; docs inventory.
Zakres:
  - Move to docs/audits/archive/ with date prefixes.
  - Add docs/audits/archive/README.md index.
  - Prepend HISTORICAL banner to each archived file.
  - Fix inbound links in README, backend-migration/README.md, ARCHIVED_CUTOVER_DOCS.md.
Poza zakresem: Deleting ARCHIVED_CUTOVER_DOCS.md; app code.
Pliki: See audit §7 ARCHIVE list.
Kroki:
  1. rg all references to each file.
  2. git mv to archive paths.
  3. Add banner + archive README.
  4. Update links.
Acceptance criteria:
  - docs/ root has no PROJECT_TECHNICAL_AUDIT.md.
  - Archived files have visible historical header.
  - rg shows no broken links from README/AGENTS.
Testy: rg link audit.
Walidacja: git diff --check; manual README preview.
Ryzyka: Lost context if banners omit original date/commit.
Rollback: git revert move commit.
Zależności: None.
Dokumentacja: docs/audits/archive/README.md (new)
```

### DOC-003

```
ID: DOC-003
Nazwa: Refresh backend-migration README index
Priorytet: P2
Proponowany branch: docs/backend-migration-readme-refresh
Problem: Index still implies Flask contract via frontend/src/api.js and incomplete MIG status.
Dowód: backend-migration/README.md; API_CONTRACT.md header (already updated).
Zakres: Rewrite index as "historical + living docs" with links to API_CONTRACT, deployment runbooks, archive.
Poza zakresem: Rewriting API_CONTRACT body.
Pliki: docs/backend-migration/README.md
Acceptance criteria: No instruction to read frontend/src/api.js as contract source.
Zależności: DOC-002
```

---

## Epic 2 — README factual alignment

Fix misleading sections without full rewrite (incremental PRs).

### README-001

```
ID: README-001
Nazwa: Remove scraper and fix integration descriptions
Priorytet: P0
Proponowany branch: docs/readme-remove-scraper-refs
Problem: Core capabilities list "offline scraper pipeline"; DEEPSEEK env described as scraper.
Dowód: README ~210, ~563; audit C06, C07.
Zakres: Replace scraper bullet with archived reference note or remove. Fix DEEPSEEK description to nutrition lookup.
Poza zakresem: Architecture diagram rewrite.
Acceptance criteria: rg "scraper pipeline" README → 0 in feature lists.
Zależności: None.
```

### README-002

```
ID: README-002
Nazwa: Document auth modes and middleware behavior
Priorytet: P1
Proponowany branch: docs/readme-auth-modes
Problem: README doesn't explain default JWT in localStorage vs optional BFF; middleware hint-only.
Dowód: audit §3.1, §5 items 9–10.
Zakres: New subsection under Architecture: default auth path, BFF flag, middleware limitation, link FRONTEND_NEXT_BFF.md.
Poza zakresem: Enabling BFF in production.
Acceptance criteria: Reader understands production default without reading source.
Zależności: None.
Dokumentacja: README.md, cross-link FRONTEND_NEXT_BFF.md
```

### README-003

```
ID: README-003
Nazwa: Fix Redis/worker and observability labels
Priorytet: P1
Proponowany branch: docs/readme-redis-worker-observability
Problem: Redis badge "Queue & Cache"; Grafana implied production-ready; worker "optional" underspecified.
Dowód: audit §3.3, §3.4, C08, C15.
Zakres:
  - Redis → "Job queue (worker scaffold)".
  - Observability subsection: local Prometheus/Grafana only; Grafana unprovisioned.
  - Worker: not in Compose; not CI-deployed; process_job stub.
Poza zakresem: Implement Grafana provisioning.
Acceptance criteria: Status table matches audit matrix.
Zależności: WORKER-001 decision helpful but not blocking doc truth.
```

### README-004

```
ID: README-004
Nazwa: Document CI deploy job and known limitations
Priorytet: P2
Proponowany branch: docs/readme-ci-and-limitations
Problem: CI jobs table omits deploy-production; no limitations for password reset email, ephemeral AI cache.
Dowód: ci.yml deploy job; auth_service forgot_password; audit §10.
Zakres: Add deploy job row; add Known limitations subsection.
Acceptance criteria: Limitations list matches audit §10 open items.
Zależności: None.
```

---

## Epic 3 — Architecture decisions (ADR-style tasks)

### BFF-001

```
ID: BFF-001
Nazwa: ADR — production BFF decision
Priorytet: P1
Proponowany branch: docs/adr-bff-production-decision
Problem: BFF implemented but off in prod; no recorded decision.
Dowód: lib/bff/config.ts; railway.toml; audit §11.
Zakres: Create docs/adr/0001-bff-production-mode.md with options A–D, recommendation, consequences.
Poza zakresem: Enabling BFF on Railway.
Acceptance criteria: ADR merged; README links to ADR from auth section (can be README-002 follow-up).
Zależności: README-002
```

### WORKER-001

```
ID: WORKER-001
Nazwa: ADR — Redis worker keep or remove
Priorytet: P1
Proponowany branch: docs/adr-worker-decision
Problem: Worker scaffold deployed optionally on Railway but rejects all jobs; Redis cost without value.
Dowód: jobs.py; ci.yml deploy (no worker); audit §3.3, §12.
Zakres: ADR docs/adr/0002-background-worker.md choosing A (remove) or C (first job).
Poza zakresem: Implementation in same PR.
Acceptance criteria: Written decision with owner timeline.
Zależności: None.
```

### WORKER-002

```
ID: WORKER-002
Nazwa: Execute worker decision — remove scaffold
Priorytet: P1
Proponowany branch: chore/remove-worker-scaffold
Problem: Dead worker misleads ops.
Dowód: WORKER-001 if option A chosen.
Zakres:
  - Remove ontrack-worker from DEPLOY.md service table OR mark decommissioned.
  - Remove railway.worker*.toml OR add DEPRECATED header.
  - Remove worker/ package if no jobs planned.
  - Update README, compose (keep Redis only if other use — currently none → consider removing Redis from Compose).
Poza zakresem: If option C chosen, implement real job instead.
Acceptance criteria: No Railway service docs for inactive worker; tests pass.
Testy: Remove/adapt test_worker_catalog_seed.py.
Walidacja: uv run pytest -q
Ryzyka: Future async needs reintroduce queue.
Zależności: WORKER-001
```

### WORKER-003

```
ID: WORKER-003
Nazwa: Execute worker decision — first real async job
Priorytet: P1
Proponowany branch: feat/worker-import-parse-job
Problem: Worker exists without product value.
Dowód: WORKER-001 if option C chosen.
Zakres: One handler (e.g. enqueue receipt parse from import); deploy worker in CI; integration test.
Poza zakresem: Multiple job types.
Zależności: WORKER-001
Note: Mutually exclusive with WORKER-002.
```

---

## Epic 4 — Observability and ops

### OBS-001

```
ID: OBS-001
Nazwa: Grafana provisioning or honest removal from stack
Priorytet: P2
Proponowany branch: chore/grafana-provisioning-minimal
Problem: Grafana container runs without datasource/dashboards.
Dowód: docker-compose.yml; no monitoring/grafana/
Zakres: Add provisioning for Prometheus datasource + one dashboard OR remove Grafana from README/compose and document Prometheus-only local dev.
Acceptance criteria: Fresh compose up → usable metrics UI OR README says Prometheus-only.
Zależności: README-003
```

### OBS-002

```
ID: OBS-002
Nazwa: Extend metrics for production usefulness
Priorytet: P3
Proponowany branch: feat/metrics-request-counts
Problem: /metrics only exposes up/db gauges.
Dowód: main.py metrics handler.
Zakres: Add request counter middleware (minimal); document in README observability.
Poza zakresem: Full Prometheus on Railway.
Acceptance criteria: test_health_contract covers new metric names.
Zależności: None.
```

### OPS-001

```
ID: OPS-001
Nazwa: Sync deployment runbook with CI deploy job
Priorytet: P1
Proponowany branch: docs/deploy-runbook-ci-sync
Problem: DEPLOY.md and deployment docs must match actual deploy-production job services.
Dowód: .github/workflows/ci.yml deploy-production; .github/DEPLOY.md
Zakres: Verify service names, preDeploy migrations, health URLs; add troubleshooting for GraphQL timeout (historical).
Acceptance criteria: Step-by-step matches ci.yml; no Flask references.
Zależności: DOC-002
Pliki: .github/DEPLOY.md, docs/deployment/RAILWAY_BACKEND_MIGRATION.md
```

### OPS-002

```
ID: OPS-002
Nazwa: Document password reset limitation
Priorytet: P2
Proponowany branch: docs/password-reset-limitation
Problem: API exists but no email delivery in production.
Dowód: auth_service.forgot_password returns token only in debug/testing.
Zakres: README limitation + API_CONTRACT note; optional UI hide forgot-password until email exists.
Poza zakresem: Email provider integration (separate feat if desired).
Acceptance criteria: Docs state reset is dev-only token unless email configured.
Zależności: README-004
```

---

## Epic 5 — CI and contract hygiene

### CI-001

```
ID: CI-001
Nazwa: Document full CI matrix vs local pytest subset
Priorytet: P2
Proponowany branch: docs/ci-job-matrix
Problem: README lists jobs but not which tests run where; Makefile test target ≠ full suite.
Dowód: ci.yml test job vs full 198 tests; Makefile test target.
Zakres: Table mapping job → commands → test directories.
Acceptance criteria: Developer knows `make test` is subset.
Pliki: README.md or new docs/TESTING.md (only if README too long).
Zależności: None.
```

### CI-002

```
ID: CI-002
Nazwa: Optional OpenAPI schema.ts drift check
Priorytet: P3
Proponowany branch: chore/ci-openapi-schema-drift
Problem: Only openapi.json drift-checked; schema.ts can drift silently.
Dowód: ci.yml; frontend-next generate:api
Zakres: Add git diff on schema.ts after generate in frontend-next job.
Acceptance criteria: CI fails on schema drift.
Zależności: None.
```

---

## Epic 6 — Portfolio and production readiness

### PROD-001

```
ID: PROD-001
Nazwa: Production readiness matrix document
Priorytet: P2
Proponowany branch: docs/production-readiness-matrix
Problem: No single checklist for go-live beyond scattered audits.
Dowód: audit §4 matrix.
Zakres: Create docs/PRODUCTION_READINESS.md from audit matrix with owner/checkbox format.
Acceptance criteria: Each row has status ACTIVE/PARTIAL/SCAFFOLD and verification command.
Zależności: DOC-001
```

### PROD-002

```
ID: PROD-002
Nazwa: Production auth smoke in runbook
Priorytet: P2
Proponowany branch: docs/production-smoke-automation
Problem: verify-production-auth.sh exists but audit did not run live smoke.
Dowód: docs/deployment/RAILWAY_AUTH_PRODUCTION_VERIFY.md
Zakres: Document when to run scripts; optional CI scheduled workflow (manual dispatch only).
Poza zakresem: Storing prod secrets in CI.
Acceptance criteria: Runbook lists script + expected outputs.
Zależności: OPS-001
```

---

## Recommended execution order

```text
Phase 1 — Truth (P0)
  DOC-002 → DOC-001 → README-001

Phase 2 — Decisions (P1)
  WORKER-001 → WORKER-002 OR WORKER-003
  BFF-001 → README-002
  README-003 → OPS-001

Phase 3 — Hardening docs (P2)
  README-004 → OPS-002 → DOC-003 → CI-001 → PROD-001

Phase 4 — Optional (P3)
  OBS-001 → OBS-002 → CI-002 → PROD-002
```

---

## Definition of Done (whole roadmap)

- [ ] README matches code for auth, Redis, worker, scraper, integrations, CI.
- [ ] One canonical current audit (June 2026) linked from README.
- [ ] Stale audits archived with historical headers, not mixed with ops docs.
- [ ] BFF and worker decisions recorded in ADRs.
- [ ] Deployment runbook matches CI deploy job.
- [ ] Local setup reproducible from README + `.env.example`.
- [ ] Production readiness matrix maintained in `docs/PRODUCTION_READINESS.md`.
- [ ] Each task merged via separate PR with validation from `.ai-rules/validation.md`.

---

## First three tasks to start

1. **DOC-002** — Archive stale audits (unblocks link fixes, reduces confusion immediately).
2. **DOC-001** — Point README to current audit (quick win after archive paths known).
3. **README-001** — Remove scraper/DeepSeek mislabels (high visibility factual fix).

---

*This roadmap intentionally excludes product feature work. For catalog/nutrition data, see completed cleanup PRs #138–#141.*
