# Current Flask backend inventory

Facts verified from OnTrack repository at plan time unless marked **inferred**.

---

## Application factory and startup

| Item | Location | Notes |
|------|----------|-------|
| Factory | `app/__init__.py` → `create_app()` | Registers blueprints, CORS, JWT, Prometheus |
| Entry | `run.py` | Dev server port 5000 |
| Production | `scripts/start-production.sh` | `flask db upgrade` + gunicorn `run:app` |
| Config | `config.py` | Env-based; `JWT_ACCESS_TOKEN_EXPIRES` = 7 days |
| Proxy | `ProxyFix` when not `FLASK_DEBUG` | Railway TLS / OAuth redirects |
| Health | `GET /health` | Not under `/api` |

**Dependencies:** `requirements.txt` — Flask, SQLAlchemy, Migrate, JWT, CORS, authlib, prometheus-flask-exporter, google-genai, openai, Pillow, gunicorn, pytest.

**No dedicated service layer** except `app/services/macro_lookup.py`. Business logic lives in route modules.

---

## Blueprints and route classification

Legend: **PORT** = frontend uses; **ADAPT** = port with compatibility layer; **DEPRECATE** = no frontend consumer; **REMOVE** = not needed post-cutover.

| Blueprint | Prefix | Routes | Frontend | Tests | Classification |
|-----------|--------|--------|----------|-------|----------------|
| `auth` | `/api/auth` | 8 | Yes (6 API + 2 browser OAuth) | `test_auth`, `test_local_auth`, `test_oauth`, `test_account` | **PORT** |
| `members` | `/api/members` | 5 | Yes | `test_members`, `test_members_extended` | **PORT** |
| `products` | `/api/products` | 5 | Yes | `test_products`, `test_products_extended` | **PORT** |
| `recipes` | `/api/recipes` | 9 | Yes | `test_recipes`, `test_recipes_extended` | **PORT** |
| `meal_plan` | `/api/meal-plan` | 6 | Yes | `test_meal_plan`, `test_meal_plan_summary`, `test_meal_plan_access` | **PORT** |
| `day_schedule` | `/api/day-schedule` | 6 | Yes | `test_day_schedule` | **PORT** |
| `nutrition` | `/api/nutrition` | 1 | Yes | `test_nutrition` | **PORT** |
| `import` | `/api/import` | 3 | Yes | `test_import` | **PORT** |
| `fuel` | `/api/fuel` | 1 | Yes | `test_fuel` | **PORT** |
| `public` | `/api/public` | 1 | Yes (login widget) | `test_dish_compare` (loader) | **PORT** |
| App | `/health` | 1 | No (ops) | `test_health` | **PORT** (ops parity) |

**Total Flask HTTP handlers:** 46 (including health and OAuth browser routes).

---

## Per-route detail (business rules embedded in handlers)

### Auth (`app/routes/auth.py`)

| Route | Auth | Models | Side effects | Test coverage |
|-------|------|--------|--------------|---------------|
| `GET /me` | JWT | User | Catalog seed sync + background thread | Yes |
| `POST /exchange` | Public | AuthCode, User | Single-use code | Yes |
| `GET /google` | Public | — | Cookie `pending_lang` | Yes |
| `POST /register` | Public | User, HouseholdMember | Seed catalog, primary member | Yes |
| `POST /login` | JWT issue | User | Catalog seed | Yes |
| `GET /google/callback` | Public | User, AuthCode | Redirect with code | Yes (mocked) |
| `PATCH /language` | JWT | User | Re-seed catalog | Yes |
| `DELETE /me` | JWT | All user data | Cascade delete | Yes |

**Background work:** `threading.Thread` for `ensure_user_seeded` (skipped when `TESTING`).

### Products (`app/routes/products.py`)

- Validation: `validate_product_data()` inline.
- List filters by `user_id` + `lang` + `_is_catalog_product`.
- Scoped updates/deletes by `user_id` + `lang`.

### Recipes (`app/routes/recipes.py`)

- Create replaces duplicate name; divides ingredient weight by servings.
- Update replaces ingredients wholesale.
- `fetch-image` calls Pexels + optional Gemini translate.

### Meal plan (`app/routes/meal_plan.py`)

- Member resolution via `resolve_member_id` / `member_ids_for_user`.
- Eager loading for N+1 avoidance.
- Summary computes package rounding vs `sold_by_weight`.

### Day schedule (`app/routes/day_schedule.py`)

- Week start normalized to Monday.
- Overlap detection returns `409`.

### Import (`app/routes/import_prices.py`)

- AI parse: daily limit `DAILY_LIMIT=2`, Gemini, PIL sanitization.
- Free parse: CSV/TXT heuristics.
- Apply: batch price updates max 200.

### Fuel (`app/routes/fuel.py`)

- In-memory cache until 7:00 local.
- Scrapes autocentrum.pl (PL) or gov.uk CSV (EN).

### Public (`app/routes/public.py`)

- Loads static JSON via `app/dish_compare/loader.py`.

### Nutrition (`app/routes/nutrition.py`)

- Delegates to `app/services/macro_lookup.py`.

### Members (`app/routes/members.py`)

- Max 10 members; cannot delete primary.

---

## Models and serializers

| Model | Table | Serializer | File |
|-------|-------|------------|------|
| User | `users` | `to_dict()` | `app/models/user.py` |
| Product | `products` | `to_dict()` | `app/models/product.py` |
| Recipe | `recipes` | `to_dict()`, `to_dict_summary()` | `app/models/recipe.py` |
| RecipeIngredient | `recipe_ingredients` | `to_dict()` | `app/models/recipe.py` |
| MealPlan | `meal_plans` | `to_dict(recipe_summary=)` | `app/models/meal_plan.py` |
| HouseholdMember | `household_members` | `to_dict()` | `app/models/household_member.py` |
| DayScheduleBlock | `day_schedule_blocks` | `to_dict()` | `app/models/day_schedule.py` |
| AuthCode | `auth_codes` | — | `app/models/auth_code.py` |
| ImportLog | `import_logs` | — | `app/models/import_log.py` |
| RecipeParseLog | `recipe_parse_logs` | — | `app/models/recipe_parse_log.py` |

**RecipeParseLog:** Table exists; only referenced in account deletion cascade — **no HTTP route** (inferred: reserved / unused).

---

## Supporting modules (port to `backend/app/services/` or `domain/`)

| Module | Purpose |
|--------|---------|
| `app/user_seeds/` | Default catalog seeding for new users |
| `app/dish_compare/` | Static dish comparison data + loader |
| `app/services/macro_lookup.py` | Nutrition lookup (local DB + AI cache + DeepSeek) |
| `app/import_names.py` | Product name translation for import |
| `app/gemini_client.py` | Gemini helpers for import |
| `app/pexels.py` | Recipe images |
| `app/recipe_catalog.py` | English name mapping |
| `app/product_lang_fix.py` | Script utility |
| `app/utils.py` | `current_uid`, `current_user_lang`, member name sync |
| `app/paths.py` | Path constants |
| `scraper/` | Offline pipeline — **out of API runtime scope** |

---

## Migrations (Flask-Migrate)

| Item | Detail |
|------|--------|
| Tool | Flask-Migrate / Alembic in `migrations/` |
| Versions | 20 revision files (`migrations/versions/`) |
| Head | Chain from `b1f3c7f7e6a2_initial` → latest |
| CI | Migrations **must stay in repo** (`.gitignore` comment) |
| Production | `flask db upgrade` in `start-production.sh` |

**Do not** run template foundation migrations against OnTrack production DB.

---

## Tests

| Item | Count |
|------|-------|
| Test modules | 24 under `tests/` |
| Fixture DB | SQLite in-memory (`tests/conftest.py`) |
| Auth fixture | `auth_headers` with JWT from Flask test client |
| CI | `.github/workflows/ci.yml` — pytest only, Python 3.11 |

**Coverage gaps (inferred):** No dedicated contract test suite; dish-compare API route not HTTP-tested (loader unit tests only).

---

## Environment variables (Flask backend)

| Variable | Required | Used for |
|----------|----------|----------|
| `DATABASE_URL` | Prod yes | Postgres |
| `FLASK_SECRET_KEY` | Yes | Flask sessions |
| `JWT_SECRET_KEY` | Yes | JWT signing |
| `FRONTEND_URL` | Yes | CORS + OAuth redirects |
| `GOOGLE_REDIRECT_URI` | Yes | OAuth |
| `GOOGLE_CLIENT_ID/SECRET` | Optional | Google login |
| `GEMINI_API_KEY` | Optional | Import parse, image translate |
| `PEXELS_API_KEY` | Optional | Recipe images |
| `DEEPSEEK_API_KEY` | Optional | Macro lookup |
| `AUTH_CODE_TTL_SECONDS` | Optional (120) | OAuth exchange codes |
| `FLASK_DEBUG` | Dev only | Debug mode |

---

## Railway / deployment (current — do not modify in MIG-000)

| Item | Detail |
|------|--------|
| Docs | `.github/DEPLOY.md` |
| Flow | PR → CI `test` → Railway Wait for CI → deploy |
| Services | `ontrack-back`, `ontrackapp` (per DEPLOY.md) |
| Backend | Gunicorn + Flask, `DATABASE_URL` from Railway Postgres |
| Frontend | Separate service; `REACT_APP_API_URL` at build time |

---

## Observability

| Component | Implementation |
|-----------|----------------|
| Metrics | `prometheus_flask_exporter` on Flask app |
| Local stack | Prometheus `:9090`, Grafana `:3001` in `docker-compose.yml` |
| Logging | Flask default logger (`current_app.logger`) |

---

## Scraper / scripts (not API)

| Path | Classification |
|------|----------------|
| `scraper/` | **DEFER** from API migration; keep separate |
| `app/scripts/` | Maintenance scripts; run via docker exec |
| `app/dish_compare/build.py` | Offline data build |

---

## Flask removal criteria (MIG-017)

Flask may be removed only when:

1. All **PORT** routes have FastAPI equivalents passing contract tests.
2. Production cutover completed and stability period elapsed.
3. Railway backend service runs FastAPI image exclusively.
4. `docker-compose.yml` no longer references Flask `app` service for dev default.
