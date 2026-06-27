# Technical debt

**Last updated:** 2026-06-27

Concrete issues with code evidence. Priority: **P0** (production risk) → **P3** (cosmetic).

---

## TD-001 — JWT in localStorage

| Field | Value |
|-------|-------|
| **Area** | Frontend auth |
| **Problem** | Access token stored in `localStorage` — XSS can exfiltrate token |
| **Evidence** | `frontend-next/lib/auth/storage.ts` (token persistence); BFF mode exists but production unset |
| **Risk** | Session hijack if XSS introduced |
| **Suggested fix** | Enable BFF HttpOnly cookie path in production after security review ([ROADMAP R-021](./ROADMAP.md)) |
| **Priority** | P2 |

---

## TD-002 — Password reset without email delivery

| Field | Value |
|-------|-------|
| **Area** | Auth |
| **Problem** | Reset token returned in API response (testing/debug paths) — not viable for end users |
| **Evidence** | Password reset routes in `backend/app/api/routes/auth.py`; no SMTP integration |
| **Risk** | Feature unusable in production UX |
| **Suggested fix** | SMTP + email template + rate limiting ([ROADMAP R-012](./ROADMAP.md)) |
| **Priority** | P1 |

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

## TD-004 — No production smoke tests in CI

| Field | Value |
|-------|-------|
| **Area** | CI/CD |
| **Problem** | Auth verification script requires live URLs + secrets — not run in GitHub Actions |
| **Evidence** | `backend/scripts/verify-production-auth.sh`; manual runbook in DEPLOYMENT.md |
| **Risk** | Broken deploy reaches users before manual check |
| **Suggested fix** | External synthetic monitor or post-deploy hook with Railway secrets |
| **Priority** | P1 |

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
| **Suggested fix** | Pre-commit hook or documented checklist in PR template (already caught by CI) |
| **Priority** | P3 |

---

## TD-007 — Integration test DB setup friction

| Field | Value |
|-------|-------|
| **Area** | Testing |
| **Problem** | `backend-integration` and local integration tests require Postgres `TEST_DATABASE_URL` |
| **Evidence** | `tests/integration/`, CI service container |
| **Risk** | Skipped locally → migration bugs found late |
| **Suggested fix** | Document one-liner Compose profile or `make test-integration` |
| **Priority** | P2 |

---

## TD-008 — Archive directories still referenced in old docs

| Field | Value |
|-------|-------|
| **Area** | Documentation |
| **Problem** | External links and old README sections pointed at removed paths |
| **Evidence** | Prior doc audit 2026-06-27 |
| **Risk** | Wrong setup instructions |
| **Suggested fix** | Completed in docs reset — monitor on future moves |
| **Priority** | P3 |

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

## How to add entries

Use format: ID, area, problem, evidence (file/path), risk, suggested fix, priority. Avoid vague items ("improve tests") without proof.
