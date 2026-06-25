# Project Technical Audit

**Date:** 2026-05-26  
**Scope:** Read-only audit of `/home/anon/Projects/OnTrack`  
**Method:** Repository instructions, source code, configuration, migrations, and safe local commands (tests, lint, build). No migrations on external DB, no deploys, no destructive commands.

---

## 1. Executive summary

**OnTrack** is a meal-planning and household budget web application (Polish/English UI). Users manage products and recipes, plan meals on a calendar, track day schedules, view expense summaries, and export shopping lists — with multi-member household support and JWT + Google OAuth authentication.

| Question | Answer | Evidence |
|----------|--------|----------|
| Completeness | **High for core CRUD flows**; global product catalog migration (CAT-001–008) merged in code; worker queue is scaffold-only; monitoring stack is partially wired | `backend/app/`, `docs/backend-migration/PRODUCT_CATALOG_ROADMAP.md`, `docker-compose.yml` |
| Runnable locally? | **Yes**, with Docker Compose + `.env` | `README.md`, `docker-compose.yml` |
| Frontend ↔ backend connected? | **Yes** — axios to `REACT_APP_API_URL` (default `http://localhost:5001`), Bearer JWT | `frontend/src/api.js`, `backend/app/main.py` |
| Biggest problem | **Operational gaps**: production start script does not run Alembic; Prometheus scrapes API but **no `/metrics` endpoint**; Railway worker service has **no job handlers**; API contract doc lags code (paginated products, customize endpoint) | `backend/scripts/start-production.sh`, `monitoring/prometheus.yml`, `backend/app/worker/jobs.py`, `docs/backend-migration/API_CONTRACT.md` |

**Status labels used in this report:** POTWIERDZONE W KODZIE · POTWIERDZONE TESTEM · TYLKO W DOKUMENTACJI · NIEZWERYFIKOWANE · NIE DZIAŁA

---

## 2. Technology stack

### Frontend

| Technology | Version | Use | Proof |
|------------|---------|-----|-------|
| React | 19.2.6 | UI | `frontend/package.json` |
| Create React App (`react-scripts`) | 5.0.1 | Bundler/dev server | `frontend/package.json` |
| Node (Docker build) | 20-alpine | Production image | `frontend/Dockerfile` |
| axios | ^1.16.0 | HTTP client | `frontend/src/api.js` |
| @dnd-kit/core | ^6.3.1 | Calendar drag-and-drop | `frontend/src/components/Calendar.js` |
| react-datepicker | ^9.1.0 | Date pickers | `frontend/src/components/Summary.js` |
| react-joyride | ^3.1.0 | Onboarding tour | `frontend/src/tour-steps.js` |
| @iconify/react | ^6.0.2 | Icons | Multiple components |
| Jest + Testing Library | CRA defaults | Unit tests (minimal) | `frontend/src/utils/productPage.test.js` |
| nginx | alpine | Serves production build | `frontend/Dockerfile` |

**Not used in `src/` despite being in `package.json`:** `@fullcalendar/*`, `@dnd-kit/sortable`, `web-vitals` — POTWIERDZONE W KODZIE (grep).

**Routing:** Tab state in `App.js` — **no** `react-router` — POTWIERDZONE W KODZIE.

### Backend

| Technology | Version | Use | Proof |
|------------|---------|-----|-------|
| Python | 3.11 (`>=3.11,<3.12`) | Runtime | `backend/pyproject.toml` |
| FastAPI | ^0.115 | HTTP API | `backend/app/main.py` |
| Uvicorn | ^0.32 | ASGI server | `backend/scripts/start-production.sh` |
| SQLAlchemy | ^2.0 | ORM | `backend/app/models/` |
| Alembic | ^1.14 | Migrations | `backend/alembic/versions/` |
| PostgreSQL | 15 (compose) | Production DB | `docker-compose.yml` |
| psycopg | ^3.2 | PG driver | `backend/pyproject.toml` |
| PyJWT | ^2.10 | Access tokens | `backend/app/core/security.py` |
| Authlib | ^1.4 | Google OAuth | `backend/app/api/routes/auth.py` |
| Werkzeug | ^3.1 | Password hashes (Flask-compat) | `backend/app/core/passwords.py` |
| Redis | ^5.0 | Job queue (optional) | `backend/app/worker/queue.py` |
| google-genai | ^1.0 | Receipt AI parse | `backend/app/services/gemini_client.py` |
| rapidfuzz | ^3.10 | Import name matching | `backend/app/services/import_service.py` |
| uv | lockfile | Dependency manager | `backend/uv.lock` |
| ruff | dev | Lint | `backend/pyproject.toml` |
| pytest + httpx | dev | Tests | `backend/tests/` |

**Legacy Flask runtime:** Not present under `backend/app/`. Root `app/` holds dish-compare build tooling and `user_seeds` data paths only — POTWIERDZONE W KODZIE.

### Infrastructure

| Technology | Use | Status | Proof |
|------------|-----|--------|-------|
| Docker Compose | Local full stack | DZIAŁA (config present) | `docker-compose.yml` |
| Railway | Production API + frontend + worker | TYLKO W DOKUMENTACJI + toml configs | `backend/railway.toml`, `frontend/railway.toml`, `.github/DEPLOY.md` |
| GitHub Actions | CI on PR/push to `main` | POTWIERDZONE TESTEM (workflows exist) | `.github/workflows/ci.yml` |
| Prometheus + Grafana | Local monitoring | CZĘŚCIOWO — scrape target has no metrics | `monitoring/prometheus.yml`, grep backend for `prometheus` |
| Redis | Queue + compose service | Infra only; no active jobs | `backend/app/worker/jobs.py` |
| Scraper pipeline | Offline data | NIE PODŁĄCZONY | `scraper/README.md` |

---

## 3. Repository map

Monorepo-style layout (single git repo, multiple deployable units):

```
OnTrack/
├── backend/                 # FastAPI API, Alembic, worker, runtime JSON data
│   ├── app/                 # Application code (api, services, models, worker)
│   ├── alembic/versions/    # DB migrations (2 revisions)
│   ├── data/                # Runtime seeds, macros, dish-compare JSON
│   ├── scripts/             # start-production.sh, validate_*, db_rehearsal
│   ├── tests/               # contract, integration, unit
│   ├── Dockerfile           # Production API image
│   └── railway*.toml        # Railway service configs
├── frontend/                # React SPA (CRA)
│   ├── src/                 # Components, contexts, api.js, utils
│   ├── Dockerfile           # nginx production image
│   └── Dockerfile.dev       # Dev hot-reload (compose)
├── app/                     # Legacy/auxiliary: dish_compare build, user_seeds paths
├── scraper/                 # Experimental offline pipeline (disconnected)
├── monitoring/              # prometheus.yml for local stack
├── docs/                    # Migration roadmaps, API contract, deployment
├── .ai-rules/               # Binding agent/developer rules
├── .cursor/rules/           # Cursor IDE rules
├── .github/workflows/       # CI (ci.yml)
├── docker-compose.yml       # Local: backend, worker, redis, db, frontend, prom, grafana
└── README.md                # Quick start, env vars, structure
```

| Area | Path | Responsibility |
|------|------|----------------|
| API entrypoint | `backend/app/main.py` | FastAPI app, CORS, routers, `/health` |
| Frontend entry | `frontend/src/index.js` → `App.js` | SPA shell, tab navigation |
| Contract tests | `backend/tests/contract/` | HTTP contract vs `API_CONTRACT.md` |
| Integration tests | `backend/tests/integration/` | Postgres migrations, FK behavior |
| Seeds (runtime) | `backend/data/seeds/` | Demo products/recipes JSON |
| Global catalog CLI | `backend/app/scripts/seed_global_catalog.py` | Idempotent system product import |
| CI | `.github/workflows/ci.yml` | test, backend-docker, backend-integration |
| Deploy docs | `.github/DEPLOY.md` | Railway + Wait for CI |

---

## 4. Frontend architecture

### Routing and screens

- **Pattern:** `useState('activeTab')` in `frontend/src/App.js` — tabs: `home`, `macro`, `calendar`, `schedule`, `recipes`, `products`, `summary`, `export`.
- **Auth gate:** `if (!user) return <Login />` in `AppInner` — POTWIERDZONE W KODZIE.
- **No URL routes** for main screens (except OAuth `?code=` / `?auth_error=`).

| Tab | Component | Role |
|-----|-----------|------|
| home | `Welcome.js` | Dashboard, links, `useWelcomeStats` |
| macro | `MacroCalculator.js` | BMR/TDEE; saves to member profile |
| calendar | `Calendar.js` | Meal planner (custom grid + dnd-kit) |
| schedule | `DaySchedule.js` | 24h weekly blocks per member |
| recipes | `Recipes.js` | Recipe CRUD, paste-parse, favorites |
| products | `Products.js` | Product list (paginated API), import, customize |
| summary | `Summary.js` | Cost summary, fixed expenses, charts |
| export | `Export.js` | Print/export views |
| (unauth) | `Login.js` | Login/register, Google OAuth, `DishCompare` |

### State and contexts

| Context | File | Role |
|---------|------|------|
| Language | `contexts/LanguageContext.js` | `T.pl` / `T.en`, `localStorage.lang` |
| Toast | `contexts/ToastContext.js` | Toasts + confirm modal |
| Auth | `contexts/AuthContext.js` | JWT bootstrap, login, `/api/auth/me` |
| Members | `contexts/MemberContext.js` | Household members, inclusion toggles |

### API client

- **Primary:** `frontend/src/api.js` — axios instance, Bearer from `localStorage.token`, 401 → clear token + reload.
- **Duplicate client:** `AuthContext.js` creates separate axios for bootstrap/auth — POTWIERDZONE W KODZIE.
- **Public:** `DishCompare.js` uses raw `fetch` to `/api/public/dish-compare`.

### Auth (frontend)

1. Token in `localStorage['token']`.
2. Bootstrap: `?code=` → `POST /api/auth/exchange` → store token → `GET /api/auth/me`.
3. Password: `auth.login` / `auth.register` via context.
4. Google: redirect to `{API_URL}/api/auth/google?lang=`.
5. **No refresh token** — access JWT only (7-day expiry on backend).
6. `loading` state exists but **not** used to suppress Login flash — POTWIERDZONE W KODZIE.

### Tests and build

| Command | Result (audit run) |
|---------|-------------------|
| `CI=true npm test -- --watchAll=false` | **4 passed** (`productPage.test.js`) |
| `npm run build` | **Success** (CRA production build) |

No component/E2E tests — POTWIERDZONE W KODZIE.

---

## 5. Backend architecture

### Entrypoint and layers

```
HTTP → app/api/routes/*.py → app/services/*_service.py → app/models/* → PostgreSQL
                              ↓
                         app/schemas/* (Pydantic request bodies)
                         app/services/*_presenter.py (response dicts)
```

- **Dependencies:** `app/api/dependencies.py` — `get_current_user_id` (Bearer JWT), `get_db_session`.
- **Config:** `app/core/config.py` — pydantic-settings, `.env` support.
- **Exceptions:** Routes return `JSONResponse({"error": ...})` or FastAPI handlers in `main.py`.

### API route groups (48 endpoints + `/health`)

| Router file | Prefix | Auth |
|-------------|--------|------|
| `auth.py` | `/api/auth` | Mixed (public login/OAuth + Bearer me/language/delete) |
| `members.py` | `/api/members` | Bearer |
| `products.py` | `/api/products` | Bearer |
| `recipes.py` | `/api/recipes` | Bearer |
| `meal_plan.py` | `/api/meal-plan` | Bearer |
| `day_schedule.py` | `/api/day-schedule` | Bearer |
| `nutrition.py` | `/api/nutrition` | Bearer |
| `fuel.py` | `/api/fuel` | Bearer |
| `import_prices.py` | `/api/import` | Bearer |
| `public.py` | `/api/public` | Public (`dish-compare`) |

Registered in `backend/app/main.py`.

### Product catalog (post CAT-001–008)

- **List:** `GET /api/products/?q=&limit=&offset=` → `{items, total, limit, offset}` — POTWIERDZONE W KODZIE (`product_service.list_products`).
- **System products:** `user_id IS NULL`, `source=system`; user overrides via `base_product_id`.
- **Customize:** `POST /api/products/{id}/customize` — copy-on-write for system rows.
- **Mutation policy:** 403 on system PUT/DELETE; 409 delete when product in recipes.
- **Registration seed:** No per-user product copy; `_ensure_global_catalog` + demo recipes only (`catalog_seed_service.py`) — POTWIERDZONE W KODZIE + POTWIERDZONE TESTEM.

### Database

**ORM models** (`backend/app/models/`):

| Table | Model | User isolation |
|-------|-------|----------------|
| `users` | `User` | Root |
| `auth_codes` | `AuthCode` | `user_id` FK |
| `household_members` | `HouseholdMember` | `user_id` FK |
| `products` | `Product` | `user_id` nullable (system/global); private rows scoped |
| `recipes` | `Recipe` | `user_id` |
| `recipe_ingredients` | `RecipeIngredient` | via recipe |
| `meal_plans` | `MealPlan` | `user_id` + `member_id` |
| `day_schedule_blocks` | `DayScheduleBlock` | `user_id` + `member_id` |
| `import_logs` | `ImportLog` | `user_id` |
| `recipe_parse_logs` | `RecipeParseLog` | `user_id` |

**Alembic head:** `c4e5f6a7b8c9d1` (`global_product_catalog_columns`) — revises `7966d120d748` (`initial_ontrack_schema`).

**Test DB:** SQLite in-memory for most tests (`tests/conftest.py`); Postgres required for `tests/integration/*` (skip without `TEST_DATABASE_URL`).

### Auth (backend)

| Mechanism | Implementation |
|-----------|----------------|
| Password login | `auth_service.login` → Werkzeug verify → JWT |
| Register | `auth_service.register` → hash → `ensure_user_seeded` |
| JWT | HS256, `sub`=user id, 7-day expiry, `type: access` — `security.py` |
| Google OAuth | Authlib → `AuthCode` → frontend exchange — `auth.py`, `auth_service.handle_oauth_callback` |
| Authorization | All protected routes: `Depends(get_current_user_id)` — no role-based roles |
| Refresh token | **Not implemented** |

### Worker

| Component | Status |
|-----------|--------|
| `queue.py` | Redis list or in-memory (testing); inline sync if no Redis |
| `jobs.py` | `process_job` raises `UnknownJobTypeError` for **all** types — **no handlers** |
| `run.py` | Long-poll loop (usable when jobs exist) |
| Auth enqueue | **Removed** (CAT-008) — POTWIERDZONE W KODZIE |

### Integrations

| Integration | Required | Graceful degradation |
|-------------|----------|----------------------|
| PostgreSQL | Yes (prod) | SQLite only in tests |
| Google OAuth | Optional | Login without if unset |
| Gemini | Optional | Import AI parse fails without key |
| Pexels | Optional | Recipe image fetch skipped |
| DeepSeek | Optional | Macro lookup / scraper |
| Redis | Optional | Queue unused effectively |

### Observability

| Feature | Status |
|---------|--------|
| `GET /health` | Returns `{"status":"ok"}` — POTWIERDZONE TESTEM |
| Prometheus metrics | **NIE DZIAŁA** — no `/metrics` in backend; compose still scrapes `:8000` |
| Sentry / tracing | **Not present** (grep) |
| Structured logging | Basic `logging` in worker only |

---

## 6. Frontend–backend integration

### Communication model

```
Browser (localhost:3000)
  → axios/fetch → REACT_APP_API_URL (default http://localhost:5001)
  → Authorization: Bearer <JWT>
  → FastAPI CORS (FRONTEND_URL, credentials)
```

- **CORS:** `CORSMiddleware` in `main.py` — `allow_origins` from `FRONTEND_URL`.
- **Sessions:** `SessionMiddleware` for OAuth cookie (`FLASK_SECRET_KEY`) — POTWIERDZONE W KODZIE.
- **No BFF, no OpenAPI codegen** — manual `api.js` + `API_CONTRACT.md`.

### Contract alignment

| Topic | Frontend | Backend | Status |
|-------|----------|---------|--------|
| Products list shape | `{items, total, limit, offset}` via `normalizeProductPage` | Paginated dict | DZIAŁA — POTWIERDZONE TESTEM |
| `API_CONTRACT.md` P01 | Still describes array (doc) | Paginated envelope | **Rozjazd dokumentacji** |
| `POST .../customize` | `api.js`, `Products.js` | `products.py` | DZIAŁA — brak w API_CONTRACT |
| Trailing slashes | Used on collections | Accepted | DZIAŁA |
| Refresh token | None | None | N/A |

### Endpoint coverage

All `api.js` modules map to implemented backend routers — POTWIERDZONE W KODZIE.  
Additional direct calls: `AuthContext` (`/api/auth/me`, `/api/auth/exchange`, DELETE me), `Login.js` (Google), `DishCompare` (public).

**Backend endpoints without dedicated frontend module:** None significant; all route groups have consumers.

**Frontend features without backend AI:** Recipe “parse with AI” is **client-side regex + copy-paste prompt** only — strings in `LanguageContext`, no `/api/recipes/parse` — POTWIERDZONE W KODZIE.

---

## 7. Main end-to-end flows

### 7.1 Registration (password)

```
User → Login.js (register form)
  → AuthContext.registerAccount()
  → POST /api/auth/register  [auth.py → auth_service.register]
  → User row + ensure_primary_member + ensure_user_seeded
       → _ensure_global_catalog (import system products if missing)
       → _seed_recipes (demo recipes linked to system product names)
  → JWT returned → localStorage.token
  → GET /api/auth/me (bootstrap)
  → App.js shows main tabs
```

**Files:** `frontend/src/components/Login.js`, `frontend/src/contexts/AuthContext.js`, `backend/app/api/routes/auth.py`, `backend/app/services/auth_service.py`, `backend/app/services/catalog_seed_service.py`, `backend/app/scripts/seed_global_catalog.py`

### 7.2 Login (password)

```
Login.js → auth.login → POST /api/auth/login
  → verify password → ensure_catalog_if_incomplete → JWT
  → finishAuth → token stored → /api/auth/me
```

**Files:** `auth_service.login`, `AuthContext.js`

### 7.3 Google OAuth

```
Login.js → window.location = /api/auth/google?lang=
  → auth.py Google redirect (pending_lang cookie)
  → Google → GET /api/auth/google/callback
  → auth_service.handle_oauth_callback → AuthCode → redirect FRONTEND_URL?code=
  → AuthContext bootstrap POST /api/auth/exchange → JWT
```

**Files:** `backend/app/api/routes/auth.py`, `auth_service.py`, `AuthContext.js`

### 7.4 List and customize product (global catalog)

```
Products.js → GET /api/products/?q=&limit=&offset=
  → product_service.list_products (system + own, override precedence)
  → User clicks system row → startEdit → handleSaveEdit
  → POST /api/products/{systemId}/customize
  → product_service.customize_product (copy-on-write)
  → reload list (system row hidden, private override shown)
```

**Files:** `frontend/src/components/Products.js`, `backend/app/services/product_service.py`, `backend/app/api/routes/products.py`

### 7.5 Create recipe with ingredients

```
Recipes.js → POST /api/recipes/ { name, ingredients: [{product_id, weight}] }
  → recipe_service.create_recipe
  → resolve_visible_product (allows system + own product IDs)
  → Recipe + RecipeIngredient rows
```

**Files:** `Recipes.js`, `recipe_service.py`, `backend/tests/test_product_catalog_query_layer.py`

### 7.6 Add meal to calendar

```
Calendar.js → mealPlan.addMeal POST /api/meal-plan/
  → meal_plan_service (user_id, member_id, recipe_id, date, position)
  → MealPlan row
  → Calendar refetches getRange
```

**Files:** `Calendar.js`, `meal_plan_service.py`, `test_meal_plan_contract.py`

### 7.7 Receipt import (AI)

```
Products.js → importPrices.parse(file) POST /api/import/parse
  → import_service (Gemini) → review UI → importPrices.apply POST /api/import/apply
  → updates user-owned products only (user_id filter)
```

**Files:** `Products.js`, `import_service.py`, `test_import_contract.py`  
**Requires:** `GEMINI_API_KEY` — without it: fails at runtime (not verified in audit).

### 7.8 Public dish compare (unauthenticated)

```
Login.js → DishCompare.js → fetch GET /api/public/dish-compare?lang=
  → dish_compare_loader → static JSON from backend/data
```

**Files:** `DishCompare.js`, `public.py`, `test_public_dish_compare_http.py`

---

## 8. Feature status matrix

| Function | Frontend | Backend | Tests | Status | Evidence |
|----------|----------|---------|-------|--------|----------|
| Health check | — | `/health` | `test_health_contract.py` | DZIAŁA | POTWIERDZONE TESTEM |
| Password register/login | `Login.js`, `AuthContext` | `auth_service` | `test_auth_contract.py` | DZIAŁA | POTWIERDZONE TESTEM |
| Google OAuth | `Login.js` redirect + exchange | `auth.py` | `test_auth_contract.py` | ZAIMPLEMENTOWANE, NIEZWERYFIKOWANE E2E | Needs real Google creds |
| JWT protected routes | `api.js` interceptor | `dependencies.py` | Contract suite | DZIAŁA | 401 without token |
| Household members CRUD | `MemberContext`, toggles | `member_service` | `test_members_contract.py` | DZIAŁA | POTWIERDZONE TESTEM |
| Products list (paginated) | `Products.js` | `product_service.list_products` | `test_product_catalog_query_layer.py` | DZIAŁA | POTWIERDZONE TESTEM |
| Product customize (system) | `Products.js` | `customize_product` | `test_product_catalog_mutation_policy.py` | DZIAŁA | POTWIERDZONE TESTEM |
| Product CRUD (private) | `Products.js` | `product_service` | `test_products_contract.py` | DZIAŁA | POTWIERDZONE TESTEM |
| Cross-user product IDOR | — | 404/403 guards | `test_product_catalog_safety_net.py` | DZIAŁA | POTWIERDZONE TESTEM |
| Global catalog CLI | — | `seed_global_catalog.py` | `test_global_catalog_import.py` | DZIAŁA | POTWIERDZONE TESTEM |
| Recipes CRUD | `Recipes.js` | `recipe_service` | `test_recipes_contract.py` | DZIAŁA | POTWIERDZONE TESTEM |
| Recipe + system product | `Recipes.js` | `resolve_visible_product` | `test_product_catalog_query_layer.py` | DZIAŁA | POTWIERDZONE TESTEM |
| Meal plan calendar | `Calendar.js` | `meal_plan_service` | `test_meal_plan_contract.py` | DZIAŁA | POTWIERDZONE TESTEM |
| Day schedule | `DaySchedule.js` | `day_schedule_service` | `test_day_schedule_contract.py` | DZIAŁA | POTWIERDZONE TESTEM |
| Macro calculator → profile | `MacroCalculator.js` | `members` profile PATCH | `test_members_contract.py` | DZIAŁA | POTWIERDZONE TESTEM |
| Nutrition lookup | `macroLookup.js` | `nutrition` route | `test_nutrition_contract.py` | CZĘŚCIOWO | Needs `DEEPSEEK_API_KEY` for live lookup |
| Import AI parse | `Products.js` | Gemini import | `test_import_contract.py` | CZĘŚCIOWO | Mocked/skipped without API key |
| Import free CSV | `Products.js` | `import_service` | `test_import_contract.py` | DZIAŁA | POTWIERDZONE TESTEM |
| Fuel prices | Summary expenses | `fuel_service` | `test_fuel_contract.py` | DZIAŁA | POTWIERDZONE TESTEM |
| Budget summary | `Summary.js` | meal-plan summary | `test_meal_plan_contract.py` (partial) | DZIAŁA | Frontend integration manual |
| Export / print | `Export.js` | reads cached API data | — | ZAIMPLEMENTOWANE, NIEZWERYFIKOWANE | No dedicated test |
| Dish compare widget | `DishCompare.js` | `public.py` | `test_public_dish_compare_http.py` | DZIAŁA | POTWIERDZONE TESTEM |
| Onboarding tour | `react-joyride` | — | — | ZAIMPLEMENTOWANE, NIEZWERYFIKOWANE | UI-only |
| Background worker jobs | — | `process_job` stub | `test_worker_catalog_seed.py` | MARTWY KOD | No handlers |
| Prometheus monitoring | — | no `/metrics` | — | NIE DZIAŁA | `monitoring/prometheus.yml` |
| Scraper pipeline | — | — | — | MARTWY / DISCONNECTED | `scraper/README.md` |
| Recipe AI server parse | UI strings only | **no endpoint** | — | PLACEHOLDER | `Recipes.js` client regex only |
| Refresh token | — | — | — | NIE ZAIMPLEMENTOWANE | JWT access only |

**Confirmed working (test-backed) core functions:** ~20 rows above marked DZIAŁA.

---

## 9. Database and data ownership

### Ownership model

| Data | Scope | How created |
|------|-------|-------------|
| System products | Global per `lang`, `user_id=NULL` | `seed_global_catalog` CLI or `_ensure_global_catalog` on first user seed |
| Private products | Per `user_id` | User create, import, customize override |
| Recipes | Per `user_id` | User CRUD + demo seed on register |
| Meal plans | Per `user_id` + `member_id` | User via calendar |
| Members | Per `user_id` | Auto primary on register; user adds more |
| Auth codes | Per `user_id` | OAuth callback, short TTL |

### User isolation

- Queries filter by `user_id` from JWT `sub` — POTWIERDZONE W KODZIE across services.
- Product list merges system + own; cross-user private access returns 404 — POTWIERDZONE TESTEM (`test_product_catalog_safety_net.py`).
- SQLite tests **do not enforce FK** on delete; Postgres does — documented in `test_product_catalog_postgres.py`.

### Seeds

| Source | Path | When loaded |
|--------|------|-------------|
| Demo products JSON | `backend/data/seeds/products_seed_*.json` | Global import CLI / `_ensure_global_catalog` |
| Demo recipes JSON | `backend/data/seeds/recipes_seed_*.json` | `ensure_user_seeded` on register/login/me |
| Legacy path | `app/user_seeds/data/` | Referenced in docs; runtime uses `backend/data` via `runtime_data` |

**Production note:** `start-production.sh` does **not** run `seed_global_catalog` or Alembic — manual ops — POTWIERDZONE W KODZIE.

---

## 10. Authentication and security

| Topic | Detail |
|-------|--------|
| Token type | Bearer JWT access only, 7-day expiry |
| Storage | `localStorage` (XSS exposure surface) |
| Password hashing | Werkzeug (compatible with legacy Flask hashes) |
| OAuth | Google via Authlib; auth code exchange (120s TTL) |
| CSRF | OAuth uses server session cookie + redirect |
| RBAC | None — single user type, ownership via `user_id` |
| System product protection | 403 PUT/DELETE; customize for copy-on-write |
| File upload | Import parse — multipart; size/validation in service |
| Secrets in repo | `.env` gitignored; `.env.example` placeholders only |
| JWT key length warning | Tests use 30-byte keys — pytest warning only |

---

## 11. Tests and verification results

### Commands executed (audit)

| Command | Result |
|---------|--------|
| `cd backend && uv run pytest -q` | **138 passed, 7 skipped**, 0 failed |
| `cd backend && uv run pytest --collect-only -q` | **145 tests** collected |
| `cd backend && uv run ruff check app/` | **All checks passed** |
| `cd frontend && CI=true npm test -- --watchAll=false` | **4 passed** |
| `cd frontend && npm run build` | **Success** |

### Skipped tests (local audit)

7 integration tests skip without `TEST_DATABASE_URL` (Postgres):  
`test_migrations_fresh.py`, `test_migrations_stamp.py`, `test_product_catalog_schema_migration.py`, `test_product_catalog_postgres.py`, plus worker integration — POTWIERDZONE (pytest output).

**CI runs integration** with Postgres service — `.github/workflows/ci.yml` `backend-integration` job.

### Test taxonomy

| Type | Location | Count (approx) | What they verify |
|------|----------|----------------|------------------|
| Contract | `tests/contract/` | 87 test functions | HTTP status/shape vs API contract IDs A01–H01 |
| Integration | `tests/integration/` | 10 | Real Postgres migrations, FK 409, worker rejection |
| Unit/policy | `tests/test_*.py` | 48 | Catalog import, normalize, runtime data, health |
| Frontend unit | `frontend/src/utils/productPage.test.js` | 4 | Response normalization helpers |

### Gaps

- No Playwright/Cypress E2E
- No frontend component tests
- CI **does not** run full `pytest` (subset: contract + worker + health + dish_compare)
- CI **does not** run frontend tests or build
- OAuth, Gemini, Pexels paths not integration-tested with live APIs

---

## 12. Docker, CI/CD and deployment

### Docker Compose (local)

| Service | Image/build | Port | Notes |
|---------|-------------|------|-------|
| backend | `backend/Dockerfile` | 5001→8000 | API |
| worker | same | — | `start-worker.sh` — idle without jobs |
| redis | redis:7-alpine | 6379 | |
| db | postgres:15 | 5432 | volume `postgres_data` |
| frontend | `Dockerfile.dev` | 3000 | bind-mount source |
| prometheus | prom/prometheus | 9090 | scrapes `backend:8000` (no metrics) |
| grafana | grafana/grafana | 3001 | |

### Production images

- **Backend:** `backend/Dockerfile` → `uvicorn app.main:app` via `scripts/start-production.sh`
- **Frontend:** `frontend/Dockerfile` → multi-stage Node build + nginx

### Railway (documented)

| Service | Config |
|---------|--------|
| ontrack-back | `backend/railway.toml`, healthcheck `/health` |
| ontrack-worker | `backend/railway.worker.prod.toml` |
| ontrackapp | `frontend/railway.toml`, `REACT_APP_API_URL` at build |

Deploy: push to `main` → GitHub Actions → Railway Wait for CI — `.github/DEPLOY.md`.

### CI pipeline (`.github/workflows/ci.yml`)

| Job | What runs |
|-----|-----------|
| `test` | Contract tests + worker test + health + dish_compare; SQLite; cov ≥50% |
| `backend-docker` | `docker build backend` |
| `backend-integration` | Full `tests/integration/` on Postgres |

**Not in CI:** frontend test/build, full backend pytest suite, security scan.

### Migrations on deploy

`start-production.sh` validates secrets and starts uvicorn — **does not** run `alembic upgrade head`. Migrations are **manual** per `backend/README.md` and migration docs — POTWIERDZONE W KODZIE.

---

## 13. Configuration and environment variables

| Variable | Used by | Required | Secret | Default | Defined in |
|----------|---------|----------|--------|---------|------------|
| `DATABASE_URL` | Backend ORM | Prod yes | Yes | `postgresql+psycopg://...` | `.env.example`, `config.py` |
| `JWT_SECRET_KEY` | JWT sign | Yes | Yes | dev placeholder | `.env.example`, `config.py` |
| `FLASK_SECRET_KEY` | Session/OAuth cookie | Yes | Yes | dev placeholder | `.env.example`, `config.py` |
| `FRONTEND_URL` | CORS, OAuth redirect | Yes | No | `http://localhost:3000` | `config.py` |
| `GOOGLE_CLIENT_ID/SECRET` | OAuth | Optional | Yes | None | `config.py` |
| `GOOGLE_REDIRECT_URI` | OAuth | Yes if OAuth | No | localhost callback | `config.py` |
| `GEMINI_API_KEY` | Import AI | Optional | Yes | None | `config.py` |
| `PEXELS_API_KEY` | Recipe images | Optional | Yes | None | `config.py` |
| `DEEPSEEK_API_KEY` | Macros/scraper | Optional | Yes | None | `.env.example` |
| `REDIS_URL` | Worker queue | Optional | No | None | `docker-compose.yml` |
| `REACT_APP_API_URL` | Frontend build | Prod yes | No | `http://localhost:5001` | `frontend/Dockerfile`, compose |
| `POSTGRES_*` | Docker db service | Local compose | Yes | — | `.env.example` |
| `TESTING` | Test mode queue | Tests | No | `0` | CI env |
| `TEST_DATABASE_URL` | Integration tests | CI/local int | Yes | — | CI workflow |
| `RUNTIME_DATA_DIR` | JSON data path | Optional | No | `backend/data` | `runtime_data.py` |
| `AUTH_CODE_TTL_SECONDS` | OAuth code | Optional | No | `120` | `config.py` |
| `GF_SECURITY_ADMIN_PASSWORD` | Grafana | Local only | Yes | — | `.env.example` |

---

## 14. Problems and risks

| Priorytet | Problem | Wpływ | Dowód | Rekomendacja |
|-----------|---------|-------|-------|--------------|
| P1 | Worker service runs but **no job handlers** | Wasted infra; confusing ops | `jobs.py`, compose worker service | Remove worker from compose/Railway or add real jobs |
| P1 | **Alembic not run on deploy** | Schema drift in new environments | `start-production.sh` | Add migration step to deploy runbook or startup |
| P1 | **API_CONTRACT.md outdated** (P01 array, no customize) | Doc-driven regressions | `API_CONTRACT.md` vs `product_service.py` | Update contract doc + registry |
| P1 | **Prometheus scrapes non-existent `/metrics`** | False sense of monitoring | `monitoring/prometheus.yml`, no metrics route | Add metrics or remove prom from compose |
| P2 | Frontend fetches **max 100 products** in Recipes/Summary | Incomplete catalog in dropdowns/summary | `Recipes.js`, `Summary.js` | Server search or higher limit strategy |
| P2 | CI runs **subset** of backend tests | Regressions in skipped modules | `ci.yml` vs 145 collected tests | Align CI with full suite or document split |
| P2 | CI **skips frontend** test/build | UI breaks undetected | `ci.yml` | Add `npm test` + `npm run build` job |
| P2 | **Dead code** `product_filters.py` | Maintenance noise | `backend/app/domain/product_filters.py` | Remove or wire up |
| P2 | **Duplicate axios** in AuthContext | Inconsistent interceptors | `AuthContext.js` vs `api.js` | Consolidate clients |
| P2 | SQLite vs Postgres FK divergence | False confidence in delete tests | `test_product_catalog_postgres.py` | Document; prefer PG in CI (already partial) |
| P2 | `PRODUCT_CATALOG_ROADMAP` baseline text stale | Misleading audit history | Roadmap §Problem table | Update baseline section |
| P3 | Unused npm deps (`@fullcalendar`, etc.) | Bundle size | `package.json` | Remove deps |
| P3 | No URL routing | No deep links | `App.js` | Optional react-router |
| P3 | JWT in localStorage | XSS token theft | `api.js` | Consider httpOnly cookie (larger change) |
| P3 | No refresh token | Re-login after 7 days | `security.py` | Product decision |
| P3 | Legacy `app/user_seeds` at repo root | Confusion with `backend/data` | `app/user_seeds/` | Consolidate docs/paths |
| P3 | Scraper marked experimental | None if ignored | `scraper/README.md` | Keep disconnected until quality fixed |

**P0:** None identified that block local run or cause data loss in tested paths. Production migration/seed ops remain operator-dependent.

---

## 15. What works today

Confirmed by **tests and/or successful build** in this audit:

1. FastAPI app boots with health endpoint
2. Password auth (register, login, me, language, delete account)
3. JWT authorization on protected routes
4. Household members CRUD + profile (macros)
5. Product catalog: list/search/pagination, private CRUD, system customize, IDOR guards
6. Global catalog import (idempotent CLI logic)
7. Recipes CRUD, favorites, categories, ingredients with system products
8. Meal plan: day, range, add, copy, delete, summary
9. Day schedule: blocks CRUD, bulk, week clear
10. Nutrition lookup endpoint (contract)
11. Import parse-free CSV and apply price updates
12. Fuel prices endpoint
13. Public dish-compare HTTP endpoint
14. Frontend production build
15. Frontend product page response normalization (unit tests)
16. Backend ruff lint clean
17. Registration seeds global catalog + demo recipes without per-user product copies

---

## 16. What does not work or is unfinished

| Item | Status |
|------|--------|
| Background worker job processing | MARTWY — `process_job` rejects all types |
| Prometheus metrics collection | NIE DZIAŁA — no exporter on API |
| Server-side recipe AI parse | PLACEHOLDER — UI prompt only |
| Scraper → backend runtime | DISCONNECTED by design |
| Google OAuth E2E | NIEZWERYFIKOWANE without credentials |
| Gemini receipt parse live | NIEZWERYFIKOWANE without API key |
| Automatic DB migrate on container start | NIE ZAIMPLEMENTOWANE |
| Automatic global catalog on Railway deploy | NIE ZAIMPLEMENTOWANE — manual CLI |
| Full product list in Recipes/Summary (beyond 100) | CZĘŚCIOWO |
| E2E browser tests | BRAK |
| Refresh tokens | BRAK |

---

## 17. How to run the project

Commands **verified from repo config** and/or **executed in audit**:

### Full stack (Docker)

```bash
cp .env.example .env
# Edit secrets
docker compose up --build
```

URLs: frontend `http://localhost:3000`, API `http://localhost:5001`, health `http://localhost:5001/health` — `README.md`.

### Backend only (local)

```bash
cd backend
uv sync --dev
uv run uvicorn app.main:app --reload --port 8000
curl -s http://localhost:8000/health
```

`backend/README.md` — note compose maps **5001** externally.

### Frontend only (local)

```bash
cd frontend
npm ci
npm start
# REACT_APP_API_URL=http://localhost:5001
```

### Tests

```bash
# Backend (full — audit ran)
cd backend && uv run pytest -q

# Backend (CI subset)
cd backend && uv run pytest tests/contract/ tests/integration/test_worker_catalog_seed.py \
  tests/test_health.py tests/test_dish_compare_data.py -q

# Backend integration (needs Postgres)
TEST_DATABASE_URL=postgresql+psycopg://... uv run pytest tests/integration/ -v

# Frontend
cd frontend && CI=true npm test -- --watchAll=false
```

### Lint

```bash
cd backend && uv run ruff check app/
```

### Build

```bash
cd frontend && npm run build
docker build -t ontrack-api backend
```

### Migrations (manual)

```bash
cd backend
export DATABASE_URL=postgresql+psycopg://...
uv run alembic upgrade head
uv run alembic current
```

### Global catalog seed (manual)

```bash
cd backend
uv run python -m app.scripts.seed_global_catalog --lang pl
```

### Worker (runs but processes no jobs)

```bash
cd backend && uv run python -m app.worker.run
# or: docker compose up worker
```

---

## 18. Recommended next steps

### P0 — natychmiast

- Brak blokerów kodowych z tego audytu; upewnij się, że **produkcja** ma wykonane `alembic upgrade head` (lub stamp) oraz `seed_global_catalog` przed przyjmowaniem użytkowników.

### P1 — przed dalszym rozwojem

1. Zaktualizuj `docs/backend-migration/API_CONTRACT.md` (P01 paginated shape, customize endpoint).
2. Usuń lub napraw worker w Compose/Railway (brak handlerów).
3. Napraw monitoring (dodaj `/metrics` lub usuń Prometheus z compose).
4. Udokumentuj/ zautomatyzuj migrate + global seed w deploy runbook.

### P2 — przed produkcją

1. Rozszerz CI o pełny `pytest` lub uzasadnij subset.
2. Dodaj frontend `npm test` + `npm run build` do CI.
3. Recipes/Summary: paginacja lub search API dla pełnego katalogu.
4. Usuń martwy kod (`product_filters.py`) i nieużywane zależności frontend.

### P3 — późniejsze ulepszenia

1. react-router i deep linking.
2. Konsolidacja klientów HTTP.
3. E2E testy (Playwright).
4. OpenAPI → typy TS.
5. Refresh token lub krótsza sesja + rotation policy.

---

## 19. Evidence appendix

### Instructions read

- `AGENTS.md`, `CLAUDE.md`, `README.md`
- `.ai-rules/architecture.md`, `.ai-rules/workers.md` (referenced via AGENTS index)
- `docs/backend-migration/API_CONTRACT.md`, `PRODUCT_CATALOG_ROADMAP.md`
- `.github/DEPLOY.md`, `scraper/README.md`

### Key source files

| Area | Paths |
|------|-------|
| API entry | `backend/app/main.py` |
| Auth | `backend/app/services/auth_service.py`, `backend/app/api/routes/auth.py`, `frontend/src/contexts/AuthContext.js` |
| Products | `backend/app/services/product_service.py`, `frontend/src/components/Products.js` |
| Catalog seed | `backend/app/services/catalog_seed_service.py`, `backend/app/scripts/seed_global_catalog.py` |
| Worker | `backend/app/worker/queue.py`, `jobs.py`, `run.py` |
| Models | `backend/app/models/*.py` |
| Migrations | `backend/alembic/versions/*.py` |
| Frontend shell | `frontend/src/App.js`, `frontend/src/api.js` |
| Compose | `docker-compose.yml` |
| CI | `.github/workflows/ci.yml` |
| Config | `backend/app/core/config.py`, `.env.example` |

### Test artifacts

- `backend/tests/contract/contract_registry.py` — contract ID map
- `backend/tests/conftest.py` — SQLite test harness
- `frontend/src/utils/productPage.test.js`

---

*End of audit report.*
