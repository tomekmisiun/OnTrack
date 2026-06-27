# Current state

**Last verified:** 2026-06-27 (code at `main`, Alembic head `c2d3e4f5a6b7`)

OnTrack is a **meal planner and budget tracker** for households. Production runs on **Railway** with a **FastAPI** API and **Next.js 15** frontend against **PostgreSQL 15**.

---

## What works today

| Area | Status | Notes |
|------|--------|-------|
| User auth (register, login, JWT) | Implemented | Bearer token in localStorage; optional BFF cookie mode for local dev |
| Google OAuth | Implemented | Requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, redirect URI |
| Password reset API | Implemented | Token returned in API response in testing/debug — **no email delivery** |
| Household members | Implemented | CRUD via `/api/members` |
| Products (user catalog) | Implemented | Per-user products + global catalog import |
| Recipes | Implemented | User recipes + system/global recipes by market |
| Meal plan (calendar) | Implemented | Weekly view, favorites, drag/drop |
| Day schedule | Implemented | Per-day meal slots |
| Macro / nutrition targets | Implemented | Member-level targets |
| Fuel price lookup | Implemented | Scraped/cache data; optional DeepSeek for macro lookup |
| Summary & export | Implemented | Aggregates and CSV export |
| Dish compare (public) | Implemented | `/api/public/dish-compare` — no auth |
| Locale / market separation | Implemented | UI locale vs product/recipe market (`ui_locale`, `market_code`) |
| CI pipeline | Green on `main` | See [TESTING.md](./TESTING.md) |
| Production deploy | Automated | `deploy-production` job after CI on `main` push |

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

API contract matrix: [`backend-migration/API_CONTRACT.md`](./backend-migration/API_CONTRACT.md)

---

## Partially implemented

| Area | Gap |
|------|-----|
| Password reset UX | API exists; no SMTP/email integration |
| BFF auth mode | Implemented in Next.js; **not enabled in production** (`NEXT_PUBLIC_BFF_ENABLED` unset) |
| Visual regression | Playwright visual tests exist; not in required CI |
| Staging environment | Documented historically; no dedicated staging service in repo config |

---

## Database

- **Engine:** PostgreSQL 15
- **Alembic head:** `c2d3e4f5a6b7` (`backfill_user_product_normalized_name`)
- **Pre-deploy on Railway:** `run-migrations.sh` → Alembic upgrade → `import_catalog` → `restore_post_catalog_migration`

Recent migration chain (simplified): initial schema → global catalog columns → UI locale/market → catalog market model → user product backfill.

---

## Environments

| Environment | How | Services |
|-------------|-----|----------|
| Local | `docker compose up` or backend + frontend separately | API `:5001`, Next `:3000`, Postgres `:5432`; optional Prometheus/Grafana |
| CI | GitHub Actions | Ephemeral Postgres for integration/e2e-auth |
| Production | Railway | `ontrack-back`, `ontrackapp`, Postgres plugin |

Public URLs are operator-configured in Railway (not stored in repo).

---

## CI/CD

Workflow: `.github/workflows/ci.yml`

Jobs on PR and `main`: `test`, `frontend-next`, `frontend-next-e2e`, `frontend-next-e2e-auth`, `backend-docker`, `frontend-next-docker`, `backend-integration`.

**`deploy-production`** runs only on push to `main` after all jobs pass — deploys `ontrack-back` and `ontrackapp` via `railway up`.

Details: [DEPLOYMENT.md](./DEPLOYMENT.md), [TESTING.md](./TESTING.md)

---

## External integrations

| Integration | Required | Purpose |
|-------------|----------|---------|
| Google OAuth | Optional | Social login |
| Gemini API | Optional | AI-assisted features |
| DeepSeek API | Optional | Macro lookup pipeline |
| Pexels API | Optional | Recipe imagery |

Features degrade gracefully when keys are missing.

---

## Archives (reference only)

| Path | Contents |
|------|----------|
| `archive/` | Old frontend and scraper snapshots — **not deployed** |
| `docs/audits/archive/` | Historical audits and migration notes |

Production stack: **`frontend-next/`** + **`backend/`** (FastAPI).

---

## Known risks

See [TECH_DEBT.md](./TECH_DEBT.md) and [ROADMAP.md](./ROADMAP.md).

- Catalog import during deploy mutates global recipe/product data — restore step required after re-import
- JWT in localStorage (XSS surface) — mitigated by CSP and no third-party scripts in app shell; BFF optional
- No automated production smoke in CI (secrets policy) — manual `verify-production-auth.sh`

---

## Historical snapshots

- [audits/documentation-audit-2026-06-27.md](./audits/documentation-audit-2026-06-27.md) — documentation reset audit
- [audits/archive/](./audits/archive/) — older point-in-time audits (not current state)
