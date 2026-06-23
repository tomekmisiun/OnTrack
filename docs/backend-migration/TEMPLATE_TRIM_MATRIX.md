# Template trim matrix (fastapi-production-foundation v1.0.0)

Reference: `/tmp/fastapi-production-foundation-reference` @ tag `v1.0.0`.

Classification: **KEEP** | **ADAPT** | **DEFER** | **REMOVE**

---

## Core application

| Subsystem | Decision | Rationale | Day one? | Dependencies | Maintenance | Risk |
|-----------|----------|-----------|----------|--------------|-------------|------|
| FastAPI app structure (`app/main.py`, routers) | **KEEP** | Target architecture base | Yes | uvicorn | Low | Low |
| `app/core/config.py` pydantic-settings | **ADAPT** | Map OnTrack env vars; drop tenant defaults | Yes | pydantic | Low | Low |
| SQLAlchemy session (`app/db/`) | **KEEP** | Standard persistence | Yes | SQLAlchemy | Low | Low |
| Alembic | **ADAPT** | New OnTrack-only revision chain | Yes | Postgres | Medium | **HIGH** if wrong migrations run |
| Pydantic schemas | **KEEP** | Request/response validation | Yes | pydantic | Low | Medium — must match contract shapes |
| Sync-first API (ADR) | **KEEP** | Matches Flask style | Yes | — | Low | Low |

---

## Authentication & users

| Subsystem | Decision | Rationale | Day one? | Dependencies | Maintenance | Risk |
|-----------|----------|-----------|----------|--------------|-------------|------|
| Template email login + Token schema | **REMOVE** | Conflicts with `{ token }` + username login | No | — | — | **BLOCKER** if kept |
| Template bcrypt passwords | **ADAPT** | Use werkzeug verify for OnTrack users | Yes | werkzeug | Low | **HIGH** |
| Template refresh/logout rotation | **DEFER** | Frontend unused | No | Redis optional | Medium | Low |
| Template password reset | **DEFER** | OnTrack has no reset flow | No | SMTP, worker | Medium | Low |
| Template token_version revocation | **DEFER** | No revocation today | No | DB column | Low | Medium |
| OnTrack OAuth + AuthCode | **ADAPT** | Port from Flask; not in template | Yes | authlib/httpx | Medium | **HIGH** |
| RBAC / `user.role` | **REMOVE** | OnTrack has no roles | No | — | — | Low |
| Registration policies | **ADAPT** | Username rules from Flask | Yes | — | Low | Low |

---

## Multi-tenancy & admin

| Subsystem | Decision | Rationale | Day one? | Dependencies | Maintenance | Risk |
|-----------|----------|-----------|----------|--------------|-------------|------|
| Tenants table + `tenant_id` claims | **REMOVE** | OnTrack is single-tenant per user | No | — | — | **BLOCKER** if kept |
| Platform admin routes | **REMOVE** | Not in product | No | — | — | Low |
| Tenant dependencies | **REMOVE** | — | No | — | — | Low |
| Audit logs | **DEFER** | Useful later for gamification/compliance | No | DB, migrations | Medium | Low |

---

## Redis & worker

| Subsystem | Decision | Rationale | Day one? | Dependencies | Maintenance | Risk |
|-----------|----------|-----------|----------|--------------|-------------|------|
| Redis client | **ADAPT** | Needed for worker + optional rate limits | Staging+ | Redis container | Medium | Medium |
| Background worker | **ADAPT** | Replace Flask `threading` seed jobs (MIG-012) | After core API | Redis, worker process | Medium | Medium |
| DLQ / job reliability | **DEFER** | Seed jobs can start simple | No | Redis | Medium | Low |
| Rate limiting (auth) | **ADAPT** | Good for production; optional in local dev | Staging+ | Redis | Low | Low |
| Caching / idempotency | **DEFER** | Not required for contract parity | No | Redis | Medium | Low |

---

## Webhooks & uploads

| Subsystem | Decision | Rationale | Day one? | Dependencies | Maintenance | Risk |
|-----------|----------|-----------|----------|--------------|-------------|------|
| Webhooks + HMAC | **REMOVE** | No OnTrack consumer | No | — | — | Low |
| Generic idempotency framework | **REMOVE** | — | No | Redis | — | Low |
| File upload stack (S3/MinIO) | **REMOVE** | Import uses multipart to API, not S3 | No | MinIO | — | Low |
| Presigned URLs | **REMOVE** | — | No | — | — | Low |

Import `multipart/form-data` is **OnTrack-specific ADAPT** in routes — not template file module.

---

## Observability

| Subsystem | Decision | Rationale | Day one? | Dependencies | Maintenance | Risk |
|-----------|----------|-----------|----------|--------------|-------------|------|
| Structured logging | **KEEP** | Production debugging | Yes | — | Low | Low |
| Request ID middleware | **KEEP** | Traceability | Yes | — | Low | Low |
| Prometheus metrics | **ADAPT** | Replace flask_exporter | Yes | prometheus client | Low | Low |
| `/health` + readiness | **ADAPT** | Flask has `/health`; template has `/health/ready` | Yes | DB ping | Low | Low |
| Sentry | **DEFER** | Optional | No | Sentry DSN | Low | Low |
| Grafana/Loki stack | **DEFER** | OnTrack compose already has Prometheus/Grafana | No | observability/ | Medium | Low |

---

## Docker & tooling

| Subsystem | Decision | Rationale | Day one? | Dependencies | Maintenance | Risk |
|-----------|----------|-----------|----------|--------------|-------------|------|
| Dockerfile pattern | **ADAPT** | Python 3.11 to match current OnTrack CI | Yes | — | Low | Low |
| docker-compose service split (api/worker/redis) | **ADAPT** | Merge into monorepo root compose | MIG-002 | compose | Medium | Medium |
| Makefile | **ADAPT** | Subset: test, lint, migrate | Yes | uv optional | Low | Low |
| uv + pyproject.toml | **KEEP** | Foundation standard | Yes | uv | Low | Low — pin 3.11 if needed |

**Note:** Foundation defaults Python 3.13+; OnTrack CI uses **3.11** — **ADAPT** pin in `backend/pyproject.toml`.

---

## CI / quality gates

| Subsystem | Decision | Rationale | Day one? | Dependencies | Maintenance | Risk |
|-----------|----------|-----------|----------|--------------|-------------|------|
| pytest | **KEEP** | Existing tests port forward | Yes | — | Low | Low |
| ruff | **KEEP** | Lint consistency | Yes | — | Low | Low |
| 85% coverage floor | **DEFER** | Blocks incremental migration | No | — | — | **HIGH** if enforced day one |
| Gradual coverage policy | **ADAPT** | New modules ≥ existing bar; global floor ramps | MIG-013+ | CI | Medium | Low |
| Trivy / pip-audit / gitleaks | **ADAPT** | Add after backend CI split | MIG-014+ | GitHub Actions | Low | Low |
| Policy guard scripts | **DEFER** | Port selected guards only | No | scripts/ | Medium | Low |
| Pre-commit | **ADAPT** | Optional for contributors | No | — | Low | Low |

---

## Deployment scripts

| Subsystem | Decision | Rationale | Day one? | Dependencies | Maintenance | Risk |
|-----------|----------|-----------|----------|--------------|-------------|------|
| `scripts/deploy*.sh` | **DEFER** | Railway auto-deploy today | MIG-014 | Railway | Medium | Medium |
| Backup scripts | **DEFER** | Use Railway backups + manual pg_dump | MIG-015 | — | Low | Low |

---

## AI workflow (`.ai-rules/`)

| Subsystem | Decision | Rationale | Day one? | Dependencies | Maintenance | Risk |
|-----------|----------|-----------|----------|--------------|-------------|------|
| `.ai-rules/` (20 files) | **ADAPT** | Cherry-pick: `api`, `testing`, `database`, `incremental-work` | MIG-001 optional | — | Low | Low |
| `AGENTS.md` / `CLAUDE.md` | **ADAPT** | OnTrack-specific pointers | MIG-001 | — | Low | Low |
| Template onboarding docs | **REMOVE** from runtime | Reference only | No | — | — | Low |

---

## Template documentation

| Subsystem | Decision |
|-----------|----------|
| `docs/template-onboarding.md` | Reference only — **REMOVE** from backend tree |
| `PROJECT_STATUS.md`, `ROADMAP.md` | Reference only |

---

## Summary counts

| Decision | Count (major subsystems) |
|----------|--------------------------|
| KEEP / ADAPT | ~20 |
| DEFER | ~12 |
| REMOVE | ~15 |

---

## Verified OnTrack requirements influencing trim

| Requirement | Effect |
|-------------|--------|
| Frontend `{ token }` contract | REMOVE template Token response |
| Username registration | ADAPT auth routes |
| No org/billing | REMOVE multi-tenancy |
| Catalog seed background work | ADAPT worker (later) |
| Import multipart | ADAPT in OnTrack routes, not S3 module |
| Dish compare static JSON | PORT loader as-is |
| Railway Postgres | KEEP Alembic + stamp strategy |
