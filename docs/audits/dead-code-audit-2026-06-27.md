# Audyt martwego kodu i refaktoryzacji — 2026-06-27

**Branch roboczy (docs):** `chore/docs-audit-and-reset`  
**Metoda:** read-only — analiza kodu, CI, Docker, Railway, testów, importów, dokumentacji  
**Status:** **Etap 4 częściowo ukończony** (Task 1–8 zmergowane do `main` 2026-06-27). Task 9–10 pozostają w backlogu.

---

## Streszczenie

OnTrack to dojrzała aplikacja FastAPI + Next.js z szerokim pokryciem testami kontraktowymi i CI. **Nie ma dużych bloków martwego kodu produkcyjnego** (worker/Redis już usunięte). Główne problemy to:

1. **Legacy tooling** w root `app/` (dish_compare build, user_seeds) — runtime jest w `backend/data/`.
2. **Puste/stub moduły** backendu (`catalog_seed_service.py`, `product_filters.py`).
3. **Martwe pliki frontendu** (LanguageSwitcher, LoginForm alias, health.ts, types barrel).
4. **Duplikacja** (BFF URL builder, locale/market constants, dish_compare loader, export package math).
5. **Orphan skrypty** bez referencji w CI/Makefile.
6. **Archiwum** (`archive/`, `docs/audits/archive/`) — celowe, nie runtime.

**Nie dotykać bez analizy:** migracje Alembic, endpointy publiczne, BFF (flag off), test kompatybilności Flask JWT, `restore_post_catalog_migration`.

---

## Etap 1 — Audyt

### A. Martwy kod

#### Backend (`backend/`)

| Element | Lokalizacja | Dowód braku użycia | Uwagi |
|---------|-------------|-------------------|-------|
| `catalog_seed_service.py` | `app/services/` | Zero importów w `backend/`; tylko `DeprecationWarning` stubs | Zastąpione przez `import_catalog` |
| `product_filters.py` | `app/domain/` | `looks_like_recipe_ingredient_line` — zero importów | Flask-era helper |
| `worker/` package | `app/worker/` | Katalog **już usunięty** (ADR 0002); brak `app.worker` w kodzie | Potwierdzić w commicie |
| `export_user_catalog_to_seeds.py` | `app/scripts/` | Import `catalog_lang_for_market` z `domain/market.py` — **symbol nie istnieje** | Skrypt broken at import |
| `report_catalog_migration.py` | `app/scripts/` | Tylko `backend/data/README.md`; nie CI | Manual ops |
| `config.host`, `config.port` | `app/core/config.py` | Brak `settings.host/port` w kodzie; uvicorn via `start-production.sh` + `PORT` | Nieużywane pola Settings |
| `legacy_catalog_copy` pytest marker | `pyproject.toml` | Zero testów z tym markerem | Stary task 6 |
| `recipe_parse_logs` table | model + migration | Tylko **DELETE** w `auth_service` przy usuwaniu konta; brak INSERT | Flask-era quota log? |
| ORM `Market` model | `app/models/market.py` | Tabela seedowana w testach/migracji; **brak query w `app/`** | Migration artifact vs FK target |

#### Frontend (`frontend-next/`)

| Element | Lokalizacja | Dowód |
|---------|-------------|-------|
| `LanguageSwitcher.tsx` | `components/` | Zero importów |
| `LoginForm.tsx` | `components/auth/` | Re-export alias; zero importów |
| `fetchHealth` / `health.ts` | `lib/api/` | Zero importów poza README |
| `types/async.ts` + barrel `types/index.ts` | `types/` | Barrel nigdy importowany |
| Nieużywane eksporty OpenAPI | `openapi-helpers.ts` | `MeResponse`, `MessageResponse`, `HealthResponse` — martwe |
| `PROTECTED_PATHS`, `PUBLIC_PATHS`, `isProtectedPath` | `lib/config/routes.ts` | Używane **tylko w testach**; middleware ich nie używa |
| Template SVG | `public/file.svg`, `next.svg`, `vercel.svg` | Brak referencji |

#### Root / infra

| Element | Lokalizacja | Dowód |
|---------|-------------|-------|
| `app/dish_compare/` | root | Runtime w `backend/data/dish_compare/`; API via `dish_compare_loader.py`; policy tests zabraniają COPY w Docker |
| `app/user_seeds/` | root | README: „no longer used”; runtime = `backend/data/canonical/` |
| `reset_local_catalog_db.sh` | `backend/scripts/` | Zero referencji w repo |
| `verify-production-env.sh` | `backend/scripts/` | Stary deploy doc (usunięty); brak w `DEPLOYMENT.md` |
| `capture-ui-preview.mjs` | `frontend-next/scripts/` | Brak w `package.json`; produkuje untracked `assets/ui-preview/` |
| `split-translations.mjs` | `frontend-next/scripts/` | Brak referencji |
| `frontend-next/Dockerfile` target `runner` | duplikat | CI/Railway używają `Dockerfile.railway` |
| `archive/frontend-cra-reference/Dockerfile` | archive | Nie w Compose/CI/Railway |

#### Zależności

| Pakiet | Scope | Dowód użycia | Uwaga |
|--------|-------|--------------|-------|
| Wszystkie runtime deps w `pyproject.toml` | prod | Import w `app/` | **Brak martwych runtime deps** |
| `flask-jwt-extended` | dev | `tests/contract/test_auth_contract.py` cross-compat | Celowy test migracji |
| `@types/react-datepicker` | frontend deps | Powinno być devDependency | Kosmetyka |

#### Zmienne środowiskowe

| Zmienna | Status |
|---------|--------|
| Wszystkie w `.env.example` | Używane lub udokumentowane jako opcjonalne |
| `DATABASE_URL`, `RUNTIME_DATA_DIR`, `JWT_ACCESS_TOKEN_EXPIRES_SECONDS` | Używane w kodzie; **brak w root `.env.example`** — luka dokumentacji, nie martwy kod |
| `REDIS_URL` | **Usunięte z kodu**; tylko w archiwum docs |

---

### B. Duplikacja

| Obszar | Lokalizacje | Ryzyko niespójności |
|--------|-------------|---------------------|
| BFF URL building | `lib/api/client.ts`, `lib/api/import.ts`, `tests/unit/bff-proxy.test.ts` | Średnie — reguły path mogą się rozjechać |
| Locale/market constants | `domain/market.py` vs `import_catalog.py` (`SUPPORTED_LOCALES/MARKETS`) | Niskie — wartości muszą być identyczne |
| Dish compare loader | `app/dish_compare/loader.py` vs `backend/app/services/dish_compare_loader.py` | Niskie — produkcja używa backend |
| Package/cost math (export) | `ExportScreen.tsx` vs `meal_plan_service.get_summary()` | **Średnie** — drift kosztów |
| Schedule overlap | `lib/schedule/overlap.ts` vs `day_schedule_service._has_overlap()` | Niskie — backend authoritative |
| Fuzzy name match | frontend `recipes/search.ts` vs backend `rapidfuzz` | Średnie — UX vs server |
| Summary types | `MealPlanSummaryItem` vs `ShopSummaryItem` w Export | Niskie — type drift |
| Presenter + service pattern | wiele par `*_service` / `*_presenter` | **Intencjonalne** — nie duplikat biznesowy |

---

### C. Problemy strukturalne

| Problem | Przykład | Ocena |
|---------|----------|-------|
| Duży komponent | `ExportScreen.tsx` (~1400 linii) | Utrudnia testy; nie martwy |
| Middleware vs routes config drift | `middleware.ts` vs `lib/config/routes.ts` | Dwa źródła prawdy dla auth paths |
| Hand-written response parsers | `types/*.ts` mimo OpenAPI | Uzasadnione (luki w schema) |
| `AUTH_COMPATIBILITY.md` przepisany | living doc OK po docs reset | — |
| Service/presenter split | spójny w backend | **Dobry pattern** — nie upraszczać bez powodu |

---

### D. Pozostałości po migracjach

| Pozostałość | Stan | Akcja możliwa |
|-------------|------|---------------|
| Worker + Redis + `railway.worker*.toml` | **Usunięte** (ADR 0002) | Commit potwierdzający; archiwum docs |
| Root `app/dish_compare`, `app/user_seeds` | Legacy offline | Usunąć po przeniesieniu build do `backend/` |
| `archive/frontend-cra-reference/` | Reference only | KEEP do końca parity; potem opcjonalnie usunąć |
| `archive/scraper-legacy/` | Odłączony od API | KEEP jako reference |
| Flask JWT compat test | `test_auth_contract.py` | KEEP do świadomej rezygnacji |
| `restore_post_catalog_migration` | Każdy deploy | KEEP (TD-003); refactor później |
| `flask-jwt-extended` dev dep | Compat test | Usunąć razem z testem |
| `docker-compose.recovery.yml` comment o Redis | Stale comment | SAFE_TO_REFACTOR |
| Stare migracje Alembic | Linear chain do `c2d3e4f5a6b7` | **KEEP** — wymagana historia |

---

## Etap 2 — Klasyfikacja znalezisk

| ID | Element | Klasyfikacja | Lokalizacja | Dowód | Ryzyko | Proponowane działanie | Testy |
|----|---------|--------------|-------------|-------|--------|----------------------|-------|
| DC-01 | `catalog_seed_service.py` | SAFE_TO_DELETE | `backend/app/services/` | Brak importów | Niskie | Usuń plik | `pytest tests/contract/` |
| DC-02 | `product_filters.py` | SAFE_TO_DELETE | `backend/app/domain/` | Brak importów | Niskie | Usuń | `pytest -q` |
| DC-03 | `worker/` (deleted) | SAFE_TO_DELETE | `backend/app/worker/` | ADR 0002; brak importów | Niskie | Commit deletion | CI green |
| DC-04 | pytest marker `legacy_catalog_copy` | SAFE_TO_DELETE | `pyproject.toml` | Brak użyć | Brak | Usuń marker | — |
| DC-05 | `LanguageSwitcher.tsx` | SAFE_TO_DELETE | `frontend-next/components/` | Brak importów | Niskie | Usuń | `npm run test`, lint |
| DC-06 | `LoginForm.tsx` alias | SAFE_TO_DELETE | `frontend-next/components/auth/` | Brak importów | Niskie | Usuń | j.w. |
| DC-07 | `lib/api/health.ts` | SAFE_TO_DELETE | `frontend-next/lib/api/` | Brak importów | Niskie | Usuń + trim openapi helpers | j.w. |
| DC-08 | `types/async.ts`, barrel | SAFE_TO_DELETE | `frontend-next/types/` | Barrel nieimportowany | Niskie | Usuń lub adopt barrel | j.w. |
| DC-09 | Template SVG (3 pliki) | SAFE_TO_DELETE | `frontend-next/public/` | Brak refs | Brak | Usuń | build |
| DC-10 | `reset_local_catalog_db.sh` | SAFE_TO_DELETE | `backend/scripts/` | Zero grep refs | Niskie | Usuń lub przenieś do docs | — |
| DC-11 | `split-translations.mjs` | SAFE_TO_DELETE | `frontend-next/scripts/` | Zero refs | Niskie | Usuń | — |
| DC-12 | Unused route constants | SAFE_TO_DELETE | `lib/config/routes.ts` | Tylko test | Niskie | Usuń eksporty lub użyj w middleware | `routes.test.ts` |
| DC-13 | `pyproject.toml` description | SAFE_TO_REFACTOR | metadata | Stale „Flask migration target” | Brak | Update opis | — |
| DC-14 | `config.host/port` | SAFE_TO_REFACTOR | `config.py` | Nieużywane | Niskie | Usuń pola | `pytest -q` |
| DC-15 | Locale/market constant dup | SAFE_TO_REFACTOR | `import_catalog.py` | Duplikat `domain/market` | Średnie | Import z jednego modułu | catalog tests |
| DC-16 | BFF URL helper extract | SAFE_TO_REFACTOR | `client.ts`, `import.ts` | Duplikacja | Średnie | Wspólny helper | `bff-proxy.test.ts` |
| DC-17 | Middleware ↔ routes unification | SAFE_TO_REFACTOR | `middleware.ts`, `routes.ts` | Drift | Średnie | Jedno źródło path config | e2e smoke |
| DC-18 | `@types/react-datepicker` placement | SAFE_TO_REFACTOR | `package.json` | dev vs prod | Brak | Przenieś do devDeps | `npm ci && build` |
| DC-19 | `docker-compose.recovery.yml` Redis comment | SAFE_TO_REFACTOR | compose | Stale | Brak | Fix comment | — |
| DC-20 | `export_user_catalog_to_seeds.py` | NEEDS_VERIFICATION | `app/scripts/` | Broken import; migration-only | Średnie | Napraw import **lub** usuń | Manual smoke |
| DC-21 | Root `app/dish_compare/` | NEEDS_VERIFICATION | root `app/` | Offline build; backend ma runtime | Średnie | Przenieś build do backend **lub** usuń | `test_dish_compare_data.py` |
| DC-22 | Root `app/user_seeds/` | NEEDS_VERIFICATION | root `app/` | README says unused | Niskie | Usuń po potwierdzeniu braku workflow | policy tests |
| DC-23 | `recipe_parse_logs` table | NEEDS_VERIFICATION | DB model | Tylko delete, no insert | **Wysokie** (schema) | Analiza + migracja drop w osobnym tasku | integration |
| DC-24 | ORM `Market` model | NEEDS_VERIFICATION | `models/market.py` | Brak query w app | Średnie | Potwierdź FK plan; może KEEP | integration |
| DC-25 | `capture-ui-preview.mjs` + PNG | NEEDS_VERIFICATION | scripts, assets | Untracked artifacts | Niskie | Dodaj npm script **lub** usuń | — |
| DC-26 | `verify-production-env.sh` | NEEDS_VERIFICATION | `backend/scripts/` | Słabe refs | Niskie | Merge do verify-auth **lub** usuń | manual |
| DC-27 | Flask JWT compat test + dep | NEEDS_VERIFICATION | tests, dev deps | Świadomy guard | Średnie | KEEP do decyzji product | auth contract |
| DC-28 | `ExportScreen` package math dup | NEEDS_VERIFICATION | frontend | Duplikuje backend | **Średnie-wysokie** | Contract test parity **lub** API merge | unit + e2e |
| DC-29 | `frontend-next/Dockerfile` runner | KEEP | Dockerfile | dev target używany | — | Opcjonalnie usuń runner stage później | docker build |
| DC-30 | BFF routes (disabled prod) | KEEP | `app/api/bff/` | ADR 0001 opt-in | — | Nie usuwać | bff tests |
| DC-31 | `archive/**` | KEEP | archive | Reference + rules | — | Nie usuwać bez decyzji | — |
| DC-32 | Alembic chain | KEEP | `alembic/versions/` | Production history | — | Nie usuwać | integration |
| DC-33 | `restore_post_catalog_migration` | KEEP | deploy script | FK safety | — | Refactor later (TD-003) | integration |
| DC-34 | Presenter/service split | KEEP | backend services | Spójny pattern | — | Nie konsolidować | — |
| DC-35 | ExportScreen size | OUT_OF_SCOPE | frontend | Działa | — | Osobny refactor UI | — |
| DC-36 | Prometheus/Grafana compose | OUT_OF_SCOPE | compose | Local optional | — | Profiles w compose — osobny task | — |
| DC-37 | Shared fuzzy match FE/BE | OUT_OF_SCOPE | recipes/search | Product decision | — | Test vectors, nie wspólny kod | — |

---

## Etap 3 — Plan wykonania (małe taski, osobne branche)

### Task 1 — `chore/dead-code-backend-stubs` (P0, najniższe ryzyko)

**Zakres:** DC-01, DC-02, DC-04, DC-14, DC-13  
**Akceptacja:** `ruff check`, `pytest tests/contract/ tests/test_health.py -q` green  
**Usuń:** `catalog_seed_service.py`, `product_filters.py`, marker, unused config fields  
**Testy przed/po:** `make test`

### Task 2 — `chore/dead-code-frontend-scaffold` (P0)

**Zakres:** DC-05–DC-09, DC-12 (partial), DC-18  
**Akceptacja:** `npm run test`, `lint`, `typecheck`, `build`  
**Usuń:** LanguageSwitcher, LoginForm, health.ts, types barrel, template SVGs; trim openapi-helpers

### Task 3 — `chore/dead-code-orphan-scripts` (P1)

**Zakres:** DC-10, DC-11, DC-26 (po weryfikacji)  
**Akceptacja:** brak broken refs w docs  
**Usuń:** orphan shell scripts

### Task 4 — `chore/refactor-locale-market-single-source` (P1)

**Zakres:** DC-15  
**Akceptacja:** `build_catalog --check`, catalog pipeline tests  
**Refactor:** `import_catalog` importuje z `domain/market`

### Task 5 — `chore/refactor-bff-url-helper` (P2)

**Zakres:** DC-16  
**Akceptacja:** `tests/unit/bff-proxy.test.ts`, e2e smoke

### Task 6 — `chore/refactor-auth-path-config` (P2)

**Zakres:** DC-17  
**Akceptacja:** middleware + `routes.test.ts` + e2e auth

### Task 7 — `chore/legacy-app-dish-compare-cleanup` (P2, NEEDS_VERIFICATION)

**Zakres:** DC-21, DC-22  
**Akceptacja:** `test_architecture_policy.py`, `test_dish_compare_data.py`  
**Opcje:** (A) przenieś `build.py` do `backend/scripts/` (B) usuń root `app/` z README update

### Task 8 — `fix/export-user-catalog-script` (P2)

**Zakres:** DC-20  
**Opcje:** napraw `catalog_lang_for_market` w `domain/market.py` **lub** usuń skrypt jeśli one-time done

### Task 9 — `research/recipe-parse-logs-drop` (P3, schema)

**Zakres:** DC-23  
**Wymaga:** migracja Alembic + potwierdzenie braku zewnętrznych writerów  
**OUT_OF_SCOPE** dla szybkiego cleanup — osobny PR z integration tests

### Task 10 — `research/export-summary-parity` (P3)

**Zakres:** DC-28  
**Wymaga:** test kontraktowy package math FE vs BE — bez zmiany API na start

---

## Etap 4 — Implementacja

| Task | Branch | PR | Status |
|------|--------|-----|--------|
| 1 Backend stubs | `chore/dead-code-backend-stubs` | #155 | ✅ merged |
| 2 Frontend scaffold | `chore/dead-code-frontend-scaffold` | #156 | ✅ merged |
| 3 Orphan scripts | `chore/dead-code-orphan-scripts` | #157 | ✅ merged |
| 4 Locale/market SSOT | `chore/refactor-locale-market-single-source` | #158 | ✅ merged |
| 5 BFF URL helper | `chore/refactor-bff-url-helper` | #159 | ✅ merged |
| 6 Auth path config | `chore/refactor-auth-path-config` | #160 | ✅ merged |
| 7 Legacy root `app/` | `chore/dead-code-legacy-app-tooling` | #161 | ✅ merged |
| 8 Export script import | `chore/fix-export-user-catalog-import` | #162 | ✅ merged |
| 9 `recipe_parse_logs` drop | — | — | backlog (schema) |
| 10 Export summary parity | — | — | backlog (research) |

---

## Mapa repozytorium (skrót)

```
backend/app/          FastAPI — produkcja
backend/data/         Runtime JSON + catalog
backend/alembic/      Migracje (KEEP all)
frontend-next/        Produkcja UI
archive/              Reference only (KEEP)
docs/                 Living + audits/archive
monitoring/           Local Prometheus/Grafana only
```

---

## Ryzyka globalne

1. **Usunięcie root `app/`** bez przeniesienia `dish_compare/build.py` — utrata offline rebuild path.
2. **Drop `recipe_parse_logs`** — wymaga migracji; może być referencja w starych danych.
3. **Usunięcie Flask JWT test** — utrata guard rail na compat haseł/tokenów.
4. **Refactor export math** — widoczne dla użytkownika (koszty listy zakupów).

---

## Następny krok (propozycja)

1. ~~Task 1–8~~ — done (2026-06-27).  
2. Task 9 — migracja drop `recipe_parse_logs` po potwierdzeniu braku writerów.  
3. Task 10 — test kontraktowy package math Export vs `get_summary()`.

---

*Audyt + implementacja Task 1–8 (2026-06-27). Task 9–10 w backlogu.*
