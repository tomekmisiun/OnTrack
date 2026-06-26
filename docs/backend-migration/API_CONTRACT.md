# API contract matrix (frontend-authoritative)

**Source of truth:** `frontend-next/lib/api/*.ts`, `frontend-next/contexts/AuthContext.tsx`, OpenAPI export (`frontend-next/openapi/openapi.json`).

**Base URL:** `NEXT_PUBLIC_API_URL` or `http://localhost:5001` (see `frontend-next/lib/config/env.ts`).

**Global auth:** `Authorization: Bearer <token>` from `localStorage` (default) or HttpOnly BFF cookie when `NEXT_PUBLIC_BFF_ENABLED=1`.

**Global 401 behavior:** `lib/api/client.ts` calls `onUnauthorized` → logout; legacy CRA used `window.location.reload()`.

**Trailing slashes:** Collection endpoints use trailing slashes (e.g. `/api/products/`). FastAPI must accept the exact paths below.

---

## Summary table

| ID | Method | Path | Auth | Frontend consumer | Flask handler |
|----|--------|------|------|-------------------|---------------|
| A01 | POST | `/api/auth/login` | Public | `api.js` → `AuthContext.loginWithPassword` | `auth.login` |
| A02 | POST | `/api/auth/register` | Public | `api.js` → `AuthContext.registerAccount` | `auth.register` |
| A03 | POST | `/api/auth/exchange` | Public | `AuthContext` bootstrap | `auth.exchange_code` |
| A04 | GET | `/api/auth/me` | Bearer | `AuthContext` bootstrap, `finishAuth` | `auth.me` |
| A05 | PATCH | `/api/auth/language` | Bearer | `lib/api/auth.ts`, `AuthContext` | `auth.change_language` |
| A09 | PATCH | `/api/auth/market` | Bearer | `lib/api/auth.ts`, `ProfileModal` | `auth.change_market` |
| A06 | DELETE | `/api/auth/me` | Bearer | `AuthContext.deleteAccount` | `auth.delete_me` |
| A07 | GET | `/api/auth/google` | Public (browser) | `Login.js` redirect | `auth.google_login` |
| A08 | GET | `/api/auth/google/callback` | Public (browser) | Google → frontend `?code=` | `auth.google_callback` |
| M01 | GET | `/api/members/` | Bearer | `api.js` → `MemberContext`, etc. | `members.list_members` |
| M02 | POST | `/api/members/` | Bearer | `api.js` | `members.create_member` |
| M03 | PATCH | `/api/members/{id}` | Bearer | `api.js` | `members.rename_member` |
| M04 | DELETE | `/api/members/{id}` | Bearer | `api.js` | `members.delete_member` |
| M05 | PATCH | `/api/members/{id}/profile` | Bearer | `api.js` → `MacroCalculator.js` | `members.save_profile` |
| P01 | GET | `/api/products/` | Bearer | `api.js` → many components | `products.get_products` |
| P02 | POST | `/api/products/` | Bearer | `api.js` | `products.create_product` |
| P03 | PUT | `/api/products/{id}` | Bearer | `api.js` | `products.update_product` |
| P04 | DELETE | `/api/products/{id}` | Bearer | `api.js` | `products.delete_product` |
| P05 | DELETE | `/api/products/all` | Bearer | `lib/api/products.ts` | `products.delete_all_products` |
| P06 | POST | `/api/products/{id}/customize` | Bearer | `lib/api/products.ts`, `useProductsPage` | `products.customize_product` |
| R01 | GET | `/api/recipes/` | Bearer | `api.js` | `recipes.get_recipes` |
| R02 | GET | `/api/recipes/{id}` | Bearer | `api.js` | `recipes.get_recipe` |
| R03 | POST | `/api/recipes/` | Bearer | `api.js` | `recipes.create_recipe` |
| R04 | PUT | `/api/recipes/{id}` | Bearer | `api.js` | `recipes.update_recipe` |
| R05 | PATCH | `/api/recipes/{id}/favorite` | Bearer | `api.js` | `recipes.toggle_favorite` |
| R06 | PATCH | `/api/recipes/{id}/category` | Bearer | `api.js` | `recipes.update_category` |
| R07 | POST | `/api/recipes/{id}/fetch-image` | Bearer | `api.js` | `recipes.fetch_recipe_image` |
| R08 | DELETE | `/api/recipes/{id}` | Bearer | `api.js` | `recipes.delete_recipe` |
| R09 | DELETE | `/api/recipes/all` | Bearer | `api.js` | `recipes.delete_all_recipes` |
| MP01 | GET | `/api/meal-plan/{date}` | Bearer | `api.js` | `meal_plan.get_day` |
| MP02 | GET | `/api/meal-plan/range/{start}/{end}` | Bearer | `api.js` | `meal_plan.get_range` |
| MP03 | POST | `/api/meal-plan/` | Bearer | `api.js` | `meal_plan.add_meal` |
| MP04 | POST | `/api/meal-plan/copy` | Bearer | `api.js` | `meal_plan.copy_range` |
| MP05 | DELETE | `/api/meal-plan/{id}` | Bearer | `api.js` | `meal_plan.delete_meal` |
| MP06 | GET | `/api/meal-plan/summary/{start}/{end}` | Bearer | `api.js` | `meal_plan.get_summary` |
| DS01 | GET | `/api/day-schedule/` | Bearer | `api.js` | `day_schedule.get_blocks` |
| DS02 | POST | `/api/day-schedule/` | Bearer | `api.js` | `day_schedule.create_block` |
| DS03 | POST | `/api/day-schedule/bulk` | Bearer | `api.js` | `day_schedule.create_bulk` |
| DS04 | PATCH | `/api/day-schedule/{id}` | Bearer | `api.js` | `day_schedule.update_block` |
| DS05 | DELETE | `/api/day-schedule/{id}` | Bearer | `api.js` | `day_schedule.delete_block` |
| DS06 | DELETE | `/api/day-schedule/week` | Bearer | `api.js` | `day_schedule.delete_week_blocks` |
| N01 | GET | `/api/nutrition/lookup` | Bearer | `api.js` → `macroLookup.js` | `nutrition.lookup` |
| I01 | POST | `/api/import/parse` | Bearer | `api.js` → `Products.js` | `import_prices.parse_receipt` |
| I02 | POST | `/api/import/parse-free` | Bearer | `api.js` | `import_prices.parse_csv` |
| I03 | POST | `/api/import/apply` | Bearer | `api.js` | `import_prices.apply_prices` |
| F01 | GET | `/api/fuel/prices` | Public | `api.js` → `DrinksCard.js` | `fuel.get_fuel_prices` |
| PU01 | GET | `/api/public/dish-compare` | Public | `DishCompare.js` fetch | `public.dish_compare` |
| H01 | GET | `/health` | Public | Ops / Docker | `create_app.health` |
| H02 | GET | `/health/ready` | Public | Ops / Railway readiness | `create_app.health_ready` |
| H03 | GET | `/metrics` | Public | Prometheus (local dev) | `create_app.metrics` |

---

## Authentication endpoints

### A01 — `POST /api/auth/login`

| Field | Detail |
|-------|--------|
| Request body | `{ "username": string, "password": string }` |
| Success | `200`, `{ "token": string }` |
| Errors | `400` `{ "error": "Username and password are required" }`; `401` `{ "error": "Invalid username or password" }` |
| Frontend | Stores `res.data.token`, calls `/api/auth/me` via `finishAuth` |
| Compatibility risk | **HIGH** — template returns `{ access_token, refresh_token }`; must return `{ token }` |

### A02 — `POST /api/auth/register`

| Field | Detail |
|-------|--------|
| Request body | `{ "username": string, "password": string, "lang": "pl" \| "en" }` |
| Success | `201`, `{ "token": string }` |
| Errors | `400` validation message in `{ "error" }`; `409` `{ "error": "Username already taken" }` |
| Side effects | Creates user, primary member, seeds catalog (`auth.register`) |
| Compatibility risk | **HIGH** — template registers by email, returns `UserRead`, no token |

### A03 — `POST /api/auth/exchange`

| Field | Detail |
|-------|--------|
| Request body | `{ "code": string }` |
| Success | `200`, `{ "token": string }` |
| Errors | `400` `{ "error": "Code is required" }`; `401` `{ "error": "Invalid or expired code" }` |
| Frontend | OAuth bootstrap: URL `?code=` → exchange → store token |
| Compatibility risk | **MEDIUM** — OnTrack-specific; not in template |

### A04 — `GET /api/auth/me`

| Field | Detail |
|-------|--------|
| Success | `200`, user object: `{ "id": int, "lang": "pl"\|"en", "username"?: string, "email"?: string }` — email omitted for `@users.ontrack.local` |
| Errors | `401` (JWT loaders); `404` `{ "error": "User not found" }` |
| Side effects | Catalog seed sync + background seed thread (`auth.me`) |
| Compatibility risk | **MEDIUM** — shape differs from template `UserRead` |

### A05 — `PATCH /api/auth/language`

| Field | Detail |
|-------|--------|
| Request body | `{ "lang": "pl" \| "en" }` |
| Success | `200`, same user shape as `/me` |
| Errors | `400` `{ "error": "Invalid language" }`; `404` user not found |
| Compatibility risk | **LOW** |

### A06 — `DELETE /api/auth/me`

| Field | Detail |
|-------|--------|
| Success | `200`, `{ "message": "Account deleted" }` |
| Frontend | Then `logout()` locally |
| Compatibility risk | **LOW** |

### A07 — `GET /api/auth/google?lang=pl|en`

| Field | Detail |
|-------|--------|
| Behavior | `302` redirect to Google OAuth; sets `pending_lang` cookie |
| Errors | `503` `{ "error": "Google OAuth is not configured" }` |
| Frontend | `window.location.href` from `Login.js` |
| Compatibility risk | **HIGH** — redirect/cookie/SameSite semantics |

### A08 — `GET /api/auth/google/callback`

| Field | Detail |
|-------|--------|
| Behavior | `302` redirect to `{FRONTEND_URL}/?code=<auth_code>` or `?auth_error=...` |
| Frontend | Reads `code` or `auth_error` from query string |
| Compatibility risk | **HIGH** |

---

## Members (`/api/members/`)

### M01 — `GET /api/members/`

| Field | Detail |
|-------|--------|
| Success | `200`, **array** of member objects |
| Member shape | `{ id, name, is_primary, gender, age, weight, height, activity, goal, macro_goals: { kcal, protein, fat, carbs, goalLabel } \| null }` |
| Note | `macro_goals` is `null` when `macro_kcal` unset (`household_member.to_dict`) |

### M02 — `POST /api/members/`

| Request | `{ "name": string }` |
| Success | `201`, member object |
| Errors | `400` name required / max members |

### M03 — `PATCH /api/members/{id}`

| Request | `{ "name": string }` |
| Success | `200`, member object |

### M04 — `DELETE /api/members/{id}`

| Success | `200`, `{ "message": "Deleted" }` |
| Errors | `403` cannot delete primary |

### M05 — `PATCH /api/members/{id}/profile`

| Request | Partial: `gender`, `age`, `weight`, `height`, `activity`, `goal`, `macro_kcal`, `macro_protein`, `macro_fat`, `macro_carbs`, `macro_goal_label` |
| Success | `200`, member object |

---

## Products (`/api/products/`)

### P01 — `GET /api/products/`

| Success | `200`, **array** of product objects |
| Product shape | `{ id, name, package_weight, price, unit, kcal, protein, fat, carbs, sold_by_weight, lang }` — macros nullable |
| Filter | User's `lang`; excludes ingredient-line placeholders (`products._is_catalog_product`) |

### P02 — `POST /api/products/`

| Request | `{ name, package_weight, price, unit?, kcal?, protein?, fat?, carbs?, sold_by_weight? }` |
| Success | `201`, product object |

### P03 — `PUT /api/products/{id}`

| Request | Partial update fields |
| Success | `200`, product object |

### P04 — `DELETE /api/products/{id}`

| Success | `200`, `{ "message": "Product deleted" }` |

### P05 — `DELETE /api/products/all`

| Success | `200`, `{ "message": "Deleted N products" }` |

---

## Recipes (`/api/recipes/`)

### R01 — `GET /api/recipes/`

| Success | `200`, **array** of `to_dict_summary()` objects |
| Shape | `{ id, name, notes, is_favorite, ingredients: [], total_cost, total_kcal, total_protein, total_fat, total_carbs, kcal_100g?, protein_100g?, fat_100g?, carbs_100g?, image_url, source_url, category, servings, lang }` |

### R02 — `GET /api/recipes/{id}`

| Success | `200`, full `to_dict()` with populated `ingredients[]` |
| Ingredient shape | `{ id, product_id, product_name, package_weight, unit, kcal, protein, fat, carbs, weight, cost }` |

### R03 — `POST /api/recipes/`

| Request | `{ name, notes?, category?, servings, ingredients: [{ product_id, weight }] }` — **create divides weight by servings** |
| Success | `201`, full recipe |
| Note | Replaces existing recipe with same name+lang |

### R04 — `PUT /api/recipes/{id}`

| Request | Partial; `ingredients` replaces all — **weights stored as-is (not per-serving)** |
| Success | `200`, full recipe |

### R05 — `PATCH /api/recipes/{id}/favorite`

| Success | `200`, `{ "is_favorite": bool }` |

### R06 — `PATCH /api/recipes/{id}/category`

| Request | `{ "category": string \| null }` |
| Success | `200`, `{ "category": string \| null }` |

### R07 — `POST /api/recipes/{id}/fetch-image`

| Success | `200`, `{ "image_url": string \| null }` |

### R08/R09 — DELETE single / all

| Success | `200`, `{ "message": "..." }` |

---

## Meal plan (`/api/meal-plan/`)

### MP01 — `GET /api/meal-plan/{YYYY-MM-DD}`

| Query | `member_id` (optional int) |
| Success | `200`, **array** of meals with `recipe` summary |
| Meal shape | `{ id, date, position, recipe_id, member_id, recipe: {...} }` |

### MP02 — `GET /api/meal-plan/range/{start}/{end}`

| Query | `member_ids` comma-separated (optional) |
| Success | `200`, **object** keyed by date ISO string → meal arrays |

### MP03 — `POST /api/meal-plan/`

| Request | `{ date, position (1-5), recipe_id, member_id? }` |
| Success | `201` new meal or `200` if position exists (upsert) |
| Compatibility risk | **MEDIUM** — upsert behavior |

### MP04 — `POST /api/meal-plan/copy`

| Request | `{ source_start, source_end, target_start, member_id? }` |
| Success | `201`, `{ "message": "Copied N meals" }` |

### MP05 — `DELETE /api/meal-plan/{id}`

| Success | `200`, `{ "message": "Meal deleted" }` |

### MP06 — `GET /api/meal-plan/summary/{start}/{end}`

| Query | `member_ids` or `member_id` |
| Success | `200`, `{ items: [...], total_cost: number }` |
| Item shape | `{ product_id, product_name, total_weight, unit, package_weight, packages_exact, packages_rounded, price_per_package, total_cost, actual_cost, sold_by_weight }` |

---

## Day schedule (`/api/day-schedule/`)

### DS01 — `GET /api/day-schedule/`

| Query | `member_id`, `week_start` (ISO date, normalized to Monday) |
| Success | `200`, array of blocks; `[]` if no member |
| Errors | `400` invalid `week_start` |
| Block shape | `{ id, member_id, week_start, day (0-6), start_hour, end_hour, label }` |

### DS02 — `POST /api/day-schedule/`

| Request | `{ member_id?, week_start, day, start_hour, end_hour, label }` |
| Success | `201`, block |
| Errors | `409` `{ "error": "Overlapping activity" }` |

### DS03 — `POST /api/day-schedule/bulk`

| Request | `{ member_id?, week_start, days: int[], start_hour, end_hour, label }` |
| Success | `201` or `200`, `{ created: block[], skipped: day[] }` |

### DS04 — `PATCH /api/day-schedule/{id}`

| Request | `{ start_hour?, end_hour?, label? }` |
| Success | `200`, block |

### DS05 — `DELETE /api/day-schedule/{id}`

| Success | `200`, `{ "ok": true }` |

### DS06 — `DELETE /api/day-schedule/week`

| Query | `member_id`, `week_start` |
| Success | `200`, `{ "ok": true, "deleted": int }` |

---

## Nutrition, import, fuel, public

### N01 — `GET /api/nutrition/lookup?name=&lang=`

| Success found | `200`, `{ found: true, source, kcal, protein, fat, carbs, matched_name? }` |
| Not found | `404`, `{ found: false, error: "not_found" \| "ai_not_configured" \| "empty_name" }` |
| Errors | `400` missing name |

### I01 — `POST /api/import/parse` (multipart)

| Form | `file` (image or text) |
| Success | `200`, `{ items: importItem[], remaining_today: int }` |
| importItem | `{ receipt_name, receipt_quantity, receipt_unit, receipt_price, matched_product, suggested_price }` |
| Errors | `429` daily limit message; `503` `{ error, code: "gemini_busy" }`; `502` gemini_error |

### I02 — `POST /api/import/parse-free` (multipart)

| Form | `file` (.txt/.csv) |
| Success | `200`, `{ items: importItem[] }` (no `remaining_today`) |

### I03 — `POST /api/import/apply`

| Request | `{ updates: [{ product_id: int, price: number }, ...] }` (max 200) |
| Success | `200`, `{ "message": "Updated N products" }` |

### F01 — `GET /api/fuel/prices?lang=pl|en`

| Success | `200`, `{ benzyna: number, diesel: number, gaz?: number }` (PL has gaz) |
| Errors | `502` `{ "error": string }` |
| Auth | **None** (public) |

### PU01 — `GET /api/public/dish-compare?lang=pl|en`

| Success | `200`, `{ lang, currency, dishes[], default_delivery_price, meal_prep: { hours_per_week, avg_hourly_wage } }` |
| Errors | `503` `{ "error": string }` |

### H01 — `GET /health`

| Success | `200`, `{ "status": "ok" }` |

---

## Contract test requirements (MIG-013)

For each row above, automated tests must assert:

1. Status code for happy path and primary error paths.
2. JSON key names and nesting (not just Pydantic model names).
3. Array vs object top-level type.
4. Nullable fields present vs omitted (document per endpoint; user `to_dict` omits synthetic email).
5. Date format `YYYY-MM-DD` strings.
6. `401` triggers frontend logout path (header format).

---

## Unresolved questions

| ID | Question |
|----|----------|
| Q1 | Does Flask redirect `/api/products` → `/api/products/` in production? Capture with contract test. |
| Q2 | ~~Import daily limit status~~ — **Resolved:** `429` with error message (`import_prices.parse_receipt`). |
| Q3 | Are Prometheus metrics exposed on a path the frontend could hit? (Currently separate middleware — no frontend impact.) |

## Inferred behaviors (verify in implementation)

- Recipe create stores per-serving ingredient weights; update stores absolute weights — frontend likely depends on this asymmetry.
- `GET /api/meal-plan/range` returns `{}` for empty range, not `[]`.
- Fuel prices cached until next 7:00 local time.
