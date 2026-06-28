# Current state

**Last verified:** 2026-06-28

OnTrack is a **meal planner and budget tracker** for households. Production runs on **Railway** with a **FastAPI** API and **Next.js 15** frontend against **PostgreSQL 15**.

---

## What works today

| Area | Status | Notes |
|------|--------|-------|
| User auth (register, login, JWT) | Implemented | Bearer token in localStorage; optional BFF cookie mode for local dev |
| Google OAuth | Implemented | Requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, redirect URI |
| Password reset | Implemented | SMTP email when configured; register/login use email |
| Household members | Implemented | CRUD via `/api/members` |
| Products (user catalog) | Implemented | Per-user products + global catalog import |
| Recipes | Implemented | User recipes + system/global recipes by market |
| Meal plan (calendar) | Implemented | Weekly view, favorites, drag/drop |
| Day schedule | Implemented | Per-day meal slots |
| Macro / nutrition targets | Implemented | Member-level targets |
| Fuel price lookup | Implemented | Scraped/cache data; optional DeepSeek for macro lookup |
| Summary & export | Implemented | Aggregates and CSV export |
| Dish compare (public) | Implemented | `/api/public/dish-compare` — no auth; Next.js fallback when API unreachable |
| Locale / market separation | Implemented | UI locale vs product/recipe market (`ui_locale`, `market_code`) |
| CI pipeline | Green on `main` | 5 PR jobs — see [testing/README.md](../testing/README.md) |
| Production deploy | Staged pipeline | CI → staging deploy → smoke → approval → production deploy → smoke |

### Frontend routes (`frontend-next/`)

| Path | Purpose |
|------|---------|
| `/login` | Auth |
| `/` | Welcome / dashboard |
| `/macro` | Nutrition targets |
| `/calendar` | Meal plan calendar |
| `/schedule` | Day schedule |
| `/recipes` | Recipe management |
| `/products` | Product catalog |
| `/summary` | Summary |
| `/export` | Export |

### Backend routers (`backend/app/main.py`)

`auth`, `members`, `products`, `recipes`, `meal_plan`, `day_schedule`, `nutrition`, `fuel`, `import`, `public`

API contract: [`specs/api-contract.md`](../specs/api-contract.md)

---

## Partially implemented / optional

| Area | Gap |
|------|-----|
| BFF auth mode | Implemented in Next.js; **not enabled in production** (`NEXT_PUBLIC_BFF_ENABLED` unset) |
| Error tracking (Sentry) | Optional — `SENTRY_DSN` (API), `NEXT_PUBLIC_SENTRY_DSN` (frontend) |
| Grafana/Prometheus | Local Compose only — not wired for Railway production |

---

## Database

- **Engine:** PostgreSQL 15
- **Alembic head:** `d3e4f5a6b7c8` (`drop_recipe_parse_logs`)
- **Pre-deploy on Railway:** `run-migrations.sh` → Alembic upgrade → `import_catalog` → `restore_post_catalog_migration`

---

## Environments

| Environment | How | Services |
|-------------|-----|----------|
| Local | `docker compose up` or backend + frontend separately | API `:5001`, Next `:3000`, Postgres `:5432` |
| CI | GitHub Actions | Ephemeral Postgres for integration tests |
| Staging | Railway environment `staging` | Auto deploy + auth smoke on `main` push |
| Production | Railway environment `production` | Deploy after staging smoke + GitHub approval |

---

## CI/CD

Workflow: `.github/workflows/ci.yml`

**PR and `main` jobs:** `test`, `frontend-next`, `backend-docker`, `frontend-next-docker`, `backend-integration`.

**`main` push only:** `deploy-staging` → `wait-staging-ready` → `staging-smoke` → `deploy-production` (approval) → `production-smoke`.

Details: [operations/deployment.md](../operations/deployment.md), [testing/README.md](../testing/README.md)

---

## External integrations

| Integration | Required | Purpose |
|-------------|----------|---------|
| Google OAuth | Optional | Social login |
| Gemini API | Optional | AI-assisted features |
| DeepSeek API | Optional | Macro lookup pipeline |
| Pexels API | Optional | Recipe imagery |
| SMTP | Optional | Password reset email |

Features degrade gracefully when keys are missing.

---

## Known risks

See [tech-debt.md](./tech-debt.md) and [roadmap.md](./roadmap.md).

- Catalog import during deploy mutates global recipe/product data — restore step required after re-import
- JWT in localStorage (XSS surface) — mitigated by CSP; BFF optional per [ADR 0001](../adr/0001-bff-production-mode.md)

Production stack: **`frontend-next/`** + **`backend/`** (FastAPI). Code snapshots: [`archive/`](../../archive/) (not deployed).
