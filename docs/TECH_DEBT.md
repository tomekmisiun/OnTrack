# Technical debt

**Last updated:** 2026-06-28

Concrete issues with code evidence. Priority: **P0** (production risk) → **P3** (cosmetic). Resolved items are removed or marked resolved with evidence.

---

## TD-001 — JWT in localStorage

| Field | Value |
|-------|-------|
| **Area** | Frontend auth |
| **Problem** | Access token stored in `localStorage` — XSS can exfiltrate token |
| **Evidence** | `frontend-next/lib/auth/storage.ts`; BFF mode exists but production unset |
| **Risk** | Session hijack if XSS introduced |
| **Suggested fix** | Accepted for now per [ADR 0001](./adr/0001-bff-production-mode.md). Revisit if enabling HttpOnly cookie mode. |
| **Priority** | P2 |

---

## TD-003 — Catalog import on every deploy

| Field | Value |
|-------|-------|
| **Area** | Deploy / data |
| **Problem** | Full catalog re-import on each deploy; requires restore script for user FKs |
| **Evidence** | `backend/scripts/run-migrations.sh`; `restore_post_catalog_migration.py` |
| **Risk** | Deploy failure or data inconsistency if restore step regresses |
| **Suggested fix** | Idempotent catalog sync or import only when catalog version changes |
| **Priority** | P2 |

---

## TD-005 — Legacy env var names

| Field | Value |
|-------|-------|
| **Area** | Configuration |
| **Problem** | `FLASK_SECRET_KEY` name retained for OAuth cookie compat despite FastAPI stack |
| **Evidence** | `.env.example`, docker-compose, Railway vars |
| **Risk** | Operator confusion |
| **Suggested fix** | Alias `SESSION_SECRET_KEY` with backward-compatible read |
| **Priority** | P3 |

---

## TD-006 — OpenAPI / schema drift manual step

| Field | Value |
|-------|-------|
| **Area** | API contract |
| **Problem** | Developers must run `export:openapi` + `generate:api` after backend schema changes |
| **Evidence** | CI drift checks in `.github/workflows/ci.yml` |
| **Risk** | PR failure until regenerated |
| **Suggested fix** | Pre-commit hook or PR template checklist (already caught by CI) |
| **Priority** | P3 |

---

## TD-007 — Integration test DB setup friction

| Field | Value |
|-------|-------|
| **Area** | Testing |
| **Problem** | `backend-integration` and local integration tests require Postgres `TEST_DATABASE_URL` |
| **Evidence** | `tests/integration/`, CI service container |
| **Risk** | Skipped locally → migration bugs found late |
| **Suggested fix** | Document one-liner — see `make test-integration` in Makefile |
| **Priority** | P2 |

---

## TD-009 — Grafana/Prometheus local-only

| Field | Value |
|-------|-------|
| **Area** | Observability |
| **Problem** | Metrics stack in Compose but not wired for Railway production |
| **Evidence** | `docker-compose.yml` prometheus/grafana services; `/metrics` on API |
| **Risk** | Limited production visibility |
| **Suggested fix** | Railway metrics integration or external Prometheus |
| **Priority** | P3 |

---

## TD-010 — Export summary package math parity

| Field | Value |
|-------|-------|
| **Area** | Export / summary |
| **Problem** | Frontend export package math may diverge from backend `get_summary()` totals |
| **Evidence** | Dead-code audit DC-28; `components/export/` vs `meal_plan_service.get_summary()` |
| **Risk** | User-visible cost discrepancies in shopping list export |
| **Suggested fix** | Contract test comparing FE package math vs BE summary; align or document intentional differences |
| **Priority** | P3 |

---

## Resolved (removed from active list)

| ID | Resolution |
|----|------------|
| TD-002 | Password reset email — SMTP + register/login UI (#168, #169) |
| TD-004 | Production auth smoke — `staging-smoke` + `production-smoke` in `ci.yml`; scheduled `production-smoke.yml` |
| TD-008 | Stale doc paths — docs reset (#163) |

---

## How to add entries

Use format: ID, area, problem, evidence (file/path), risk, suggested fix, priority. Avoid vague items without proof.
