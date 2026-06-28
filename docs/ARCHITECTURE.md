# Architecture

**Last verified:** 2026-06-28

---

## Overview

```
┌─────────────┐     HTTPS      ┌──────────────────┐
│   Browser   │ ──────────────►│  ontrackapp      │
│             │                │  (Next.js 15)    │
└──────┬──────┘                └────────┬─────────┘
       │                                │
       │  API calls (Bearer JWT or       │ optional BFF routes
       │  HttpOnly cookie in dev)       │ /api/bff/*
       ▼                                ▼
┌──────────────────────────────────────────────────┐
│  ontrack-back (FastAPI)                          │
│  Routers: auth, members, products, recipes,      │
│  meal_plan, day_schedule, nutrition, fuel,       │
│  import, public                                  │
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  PostgreSQL 15  │
              └─────────────────┘
```

Local development may also run **Prometheus** and **Grafana** (Compose) scraping `/metrics` from the API.

---

## Components

### Frontend — `frontend-next/`

- **Framework:** Next.js 15 App Router, React, TypeScript
- **API client:** Generated from OpenAPI (`lib/api/generated/schema.ts`)
- **Auth:** JWT in `localStorage` by default; optional BFF proxy stores token in HttpOnly cookie when `NEXT_PUBLIC_BFF_ENABLED=1`
- **i18n:** UI strings via locale context; product/recipe data keyed by `market_code`

### Backend — `backend/app/`

Layering (see `.ai-rules/architecture.md`):

| Layer | Location | Role |
|-------|----------|------|
| Routes | `app/api/routes/` | HTTP, validation, auth deps |
| Services | `app/services/` | Business logic |
| Repositories | `app/repositories/` | DB access |
| Models | `app/models/` | SQLAlchemy ORM |
| Schemas | `app/schemas/` | Pydantic request/response |

Static/runtime data: `backend/data/` (catalog JSON, dish compare, fuel cache). Built/validated in CI via `build_catalog` and `validate_runtime_data`.

### Database

- PostgreSQL with Alembic migrations in `backend/alembic/`
- User-scoped tables (products, recipes, meal plans) plus global catalog tables (market-aware system recipes/products)

---

## Request flow (typical authenticated call)

1. Browser loads Next.js page; client reads JWT from storage (or BFF cookie via `/api/bff/me`).
2. Frontend calls `NEXT_PUBLIC_API_URL` + path (e.g. `/api/recipes`) with `Authorization: Bearer …`.
3. FastAPI `get_current_user` dependency validates JWT.
4. Route → service → repository → PostgreSQL.
5. Pydantic schema returned as JSON.

CORS: `FRONTEND_URL` on backend must list exact browser origins.

---

## Auth

| Mechanism | Details |
|-----------|---------|
| Register / login | Email + password → `{ "token": "…" }` |
| JWT | Signed with `JWT_SECRET_KEY`; sent as Bearer header |
| Google OAuth | `/api/auth/google` → callback sets session cookie (`FLASK_SECRET_KEY`) then issues JWT |
| Password reset | Request token via API; SMTP sends reset email when configured (`SMTP_*`) |
| BFF (optional) | Next.js route handlers proxy auth; see [SECURITY.md](./SECURITY.md) |

Decision record: [ADR 0001 — BFF auth](./adr/0001-bff-production-mode.md)

---

## Catalog and deploy-time import

On each Railway deploy, `run-migrations.sh`:

1. Runs Alembic to head
2. Runs `import_catalog` (refreshes global product/recipe catalog from `backend/data/`)
3. Runs `restore_post_catalog_migration` (re-links user meal plans/favorites after system recipe ID changes)

This design avoids FK violations when catalog recipes are replaced. See migration `b1c2d3e4f5a6` and script `restore_post_catalog_migration.py`.

Locale/market model: [ADR 0003](./adr/0003-ui-locale-market-separation.md)

---

## Background processing

**None.** Fuel scraping and catalog builds run synchronously in the API process or as CI/pre-deploy scripts.

---

## Observability

| Tool | Scope |
|------|-------|
| `/health`, `/health/ready` | Liveness/readiness |
| `/metrics` | Prometheus exposition |
| Prometheus + Grafana | Local Compose only |
| Railway logs | Production |
| Sentry (optional) | `SENTRY_DSN` (API), `NEXT_PUBLIC_SENTRY_DSN` (frontend) — see [SECURITY.md](./SECURITY.md) |

No APM beyond optional Sentry is required in repo configuration.

---

## Deployment topology (production)

| Railway service | Root dir | Image |
|-----------------|----------|-------|
| `ontrack-back` | `backend/` | `backend/Dockerfile` |
| `ontrackapp` | `frontend-next/` | `Dockerfile.railway` |

Deploy gate: CI on `main` → staging deploy + smoke → GitHub Environment `production` approval → production deploy + smoke. See [DEPLOYMENT.md](./DEPLOYMENT.md).

Details: [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## Boundaries and non-goals

- **No separate BFF service** — optional BFF is Next.js route handlers in the same frontend deployment
- **No message queue**
- **No multi-region**
- **CRA frontend** archived under `archive/frontend-cra-reference/` — not deployed
