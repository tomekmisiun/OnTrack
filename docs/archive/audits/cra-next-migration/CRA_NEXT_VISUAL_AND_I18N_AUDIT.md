> **HISTORICAL DOCUMENT** — Archived CRA_NEXT_VISUAL_AND_I18N_AUDIT.md. For current state see [`docs/CURRENT_STATE.md`](../../CURRENT_STATE.md).

# CRA → Next.js: Visual parity & UI locale / market audit

**Date:** 2026-06-24  
**CRA reference commit:** `dca8eb9` (last full `frontend/src/` before removal in `1040274`)  
**Production frontend:** `frontend-next/` (Next.js App Router)  
**CRA on `main` today:** `frontend/src/` **missing** — only `frontend/build/`, `frontend/node_modules/`  
**Backend:** FastAPI + PostgreSQL — **do not redesign**; extend for `ui_locale` / `market_code`

---

## 1. Executive summary

| Area | Status | Priority |
|------|--------|----------|
| **Feature parity (modules)** | ~95% complete — all routes wired, hooks + API | Low (audit edge cases) |
| **Visual parity (shell + login)** | ~25% — largest user-visible gap | **P0** |
| **Visual parity (Products/Recipes)** | Tailwind rewrite vs CRA CSS | **P1** |
| **UI locale vs product market** | **Conflated** via `users.lang` + `products.lang` | **P0** |
| **Seed on login/me/lang change** | **Active** — violates target architecture | **P0** |
| **CRA reference on disk** | Missing — blocks side-by-side comparison | **P0** |

Next.js is **functionally migrated** but **looks poorer** because global shell, login marketing, CSS ports, and demo assets were not carried over. PL/EN currently doubles as UI language **and** product catalog selector; changing language in Profile triggers backend catalog seed.

---

## 2. All CRA screens

| # | CRA screen | CRA file (`dca8eb9`) | Lines | Next.js route | Next.js file | Lines |
|---|------------|----------------------|-------|---------------|--------------|-------|
| 0 | Login (unauth) | `components/Login.js` | 424 | `/login` | `components/auth/LoginForm.tsx` | 264 |
| 1 | Welcome / Home | `components/Welcome.js` | 199 | `/` | `components/welcome/WelcomeScreen.tsx` | 276 |
| 2 | Macro | `components/MacroCalculator.js` | 536 | `/macro` | `components/macro/MacroScreen.tsx` | 540 |
| 3 | Calendar | `components/Calendar.js` | 1679 | `/calendar` | `components/calendar/CalendarScreen.tsx` | 1478 |
| 4 | Day schedule | `components/DaySchedule.js` | 862 | `/schedule` | `components/schedule/DayScheduleScreen.tsx` | 592 |
| 5 | Recipes | `components/Recipes.js` | 1309 | `/recipes` | `components/recipes/RecipesScreen.tsx` | 1689 |
| 6 | Products | `components/Products.js` | 1075 | `/products` | `components/products/ProductsScreen.tsx` | 1013 |
| 7 | Summary | `components/Summary.js` | 427 | `/summary` | `components/summary/SummaryScreen.tsx` | 717 |
| 8 | Export | `components/Export.js` | 1293 | `/export` | `components/export/ExportScreen.tsx` | 1340 |

### CRA modals / sub-views (not routes)

| CRA | File | Next.js | Status |
|-----|------|---------|--------|
| Profile | `Profile.js` (170) | `ProfileModal.tsx` (376) | Feature complete, visual partial |
| Privacy | `PrivacyPolicy.js` (200) | `PrivacyPolicyModal.tsx` (264) | Complete |
| DishCompare | `features/dishCompare/DishCompare.js` (316) | `DishCompare.tsx` (317) | Feature complete |
| DrinksCard | `DrinksCard.js` (1325) | `DrinksCard.tsx` (1246) | Feature complete |
| Help modals | inline in modules | `*HelpModal.tsx` | Complete |
| App shell | `App.js` (283) | `AppShell.tsx` + `Sidebar.tsx` | Partial |
| Tour | `App.js` TourHost + `tour-steps.js` | `TourProvider.tsx` | Complete |

### Dead Next.js scaffold (remove in cleanup task)

| File | Purpose |
|------|---------|
| `components/screens/ModulePlaceholder.tsx` | Never wired |
| `components/screens/HomeScreen.tsx` | Superseded by WelcomeScreen |
| `components/ProviderDemo.tsx` | Foundation demo |
| `components/HealthStatus.tsx` | Foundation health probe |

---

## 3. Missing functional elements

| Element | CRA | Next.js | User impact | Branch |
|---------|-----|---------|-------------|--------|
| Login showcase (7 sections) | `Login.js` SHOWCASE_SECTIONS | Missing | High — marketing page gutted | `feat/visual-parity-login` |
| Login seed stats chips | `SEED_STATS` on login | `seedStats.ts` exists, unused on login | Medium | `feat/visual-parity-login` |
| Demo WebM videos | `public/demos/*.pl.webm` (7 files) | Not in `frontend-next/public/` | High | `feat/visual-parity-login` |
| Desktop viewport scaling | `useLayoutViewport.js`, `desktopLayout.css` | Missing | Medium on mobile | `feat/visual-parity-app-shell` |
| AppFooter sitewide | `AppFooter.js` | Partial (welcome/sidebar only) | Low–medium | `feat/visual-parity-app-shell` |
| `ui_locale` ≠ `market_code` | N/A (single `lang`) | Not implemented | **High** — lang switch changes catalog | `refactor/separate-ui-locale-and-market` |
| Market selector UI | Implicit via language | Missing | High after backend split | `feat/parity-market-settings-ui` (future) |
| E2E module smoke | None in CRA | 3 auth tests only | CI gap | `test/e2e-module-smoke` |

**Not missing (confirmed):** auth flows, members, products CRUD/import, recipes parse, calendar DnD, schedule bulk, summary periods, export print HTML, joyride tour, dish compare API.

---

## 4. Missing visual elements

| Element | CRA source | Next.js | Status |
|---------|------------|---------|--------|
| AppBackground (gradient + grid) | `AppBackground.js/css` | — | **missing** |
| Global design system | `App.css` (719 ln) | `globals.css` (20 ln) + fragments | **partial** |
| Login split layout + hero | `Login.css` (1720 ln) | Tailwind `max-w-lg` card | **missing** |
| Sidebar chrome (220px, colors) | `App.css` `.app-sidebar` | Tailwind `Sidebar.tsx` | **partial** |
| Products UI | `Products.css` (694 ln) | Tailwind only | **partial** |
| Recipes UI | `Recipes.css` (967 ln) | Tailwind only | **partial** |
| MemberToggles chips | `MemberToggles.css` (224 ln) | Tailwind/inline | **partial** |
| Welcome layout classes | `Welcome.css`, `.app-main--home` | CSS ported, classes unwired | **partial** |
| Global dark scrollbars | `index.css` | Only in `summary.css` | **partial** |
| Favicon | `favicon.svg` | `favicon.ico` (Next default) | **partial** |

---

## 5. Missing assets

| Asset | CRA (`dca8eb9`) | Next.js |
|-------|-----------------|---------|
| `public/demos/calendar.pl.webm` | ✅ | ❌ |
| `public/demos/export.pl.webm` | ✅ | ❌ |
| `public/demos/macro.pl.webm` | ✅ | ❌ |
| `public/demos/products.pl.webm` | ✅ | ❌ |
| `public/demos/recipes.pl.webm` | ✅ | ❌ |
| `public/demos/schedule.pl.webm` | ✅ | ❌ |
| `public/demos/summary.pl.webm` | ✅ | ❌ |
| `public/demos/*.en.webm` | ❌ (CRA also PL-only) | ❌ |
| `public/favicon.svg` | ✅ | ❌ |
| `logo.svg` | empty file | N/A (inline SVG) |

---

## 6. CSS & layout differences

| Layer | CRA approach | Next.js approach | Risk |
|-------|--------------|------------------|------|
| Global | `index.css`, `desktopLayout.css`, `App.css` | Tailwind + minimal `globals.css` | Shell looks flat |
| Login | Dedicated `Login.css` | Tailwind utilities | Completely different page |
| Modules (legacy) | Per-module `.css` + inline styles | Ported `.css` for calendar/schedule/summary/export/macro | Closer but inline-heavy |
| Modules (new) | `Products.css`, `Recipes.css` | Tailwind rewrite | **Largest module visual drift** |
| Layout width | Fixed 1280px app, scaled on narrow | `flex min-h-screen`, responsive Tailwind | Different proportions |
| Cards/buttons | `.card`, `.btn` in `App.css` | Partial via `calendar.css` shared import | Inconsistent across modules |

---

## 7. Hardcoded user-facing strings

| Location | Issue |
|----------|-------|
| `frontend-next/lib/i18n/translations.ts` | ~1905 lines, `@ts-nocheck`, monolith |
| `ProfileModal.tsx`, `MacroScreen.tsx`, etc. | Some inline `"Error"`, `"ml / wash"` not in i18n |
| `DrinksCard.tsx` | Mixed PL/EN hardcoded field labels |
| CRA `LanguageContext.js` | Same monolith pattern (reference) |

**Target:** split into `frontend-next/messages/{pl,en}/*.json` with key parity validation.

---

## 8. Current language change flow

```text
User clicks PL/EN (Login or Profile)
  → LanguageContext.switchLang (localStorage "lang")
  → Profile: PATCH /api/auth/language { lang }
      → auth_service.change_language
          → user.lang = lang
          → ensure_catalog_if_incomplete(user_id, lang)  ← SEEDS / switches catalog
          → sync_primary_member_name
  → AuthContext.updateUserLang
  → All API modules use user.lang via backend _user_lang()
      → products, recipes, meal plan, import, nutrition filtered by lang
```

**Frontend also:** `pending_lang` in localStorage for OAuth/register; `html lang` not consistently set from user preference.

---

## 9. Current product catalog flow

```text
products.lang column (values: "pl" | "en")
  system products: user_id IS NULL, source='system', catalog_key unique per lang
  user products: user_id set, lang matches user.lang

product_service._user_lang(session, user_id)
  → returns users.lang (pl|en)

GET /api/products → filtered by user.lang
Recipe queries → filtered by user.lang
Fuel prices → lang=en → UK gov.uk (_fetch_uk), lang=pl → Poland
Dish compare public → ?lang=pl|en → PLN vs GBP datasets
```

**There is no separate market selector** — `user.lang` controls everything.

---

## 10. All seed trigger points

| Trigger | File | Function | What runs |
|---------|------|----------|-----------|
| **Login** | `auth_service.py:71` | `ensure_catalog_if_incomplete(user.id, user.lang)` | Global catalog import + recipe seed if incomplete |
| **Register** | `auth_service.py:99` | `ensure_user_seeded(user.id, lang)` | Full seed for new user |
| **GET /me** | `auth_service.py:108` | `ensure_catalog_if_incomplete` | Same |
| **PATCH /language** | `auth_service.py:123` | `ensure_catalog_if_incomplete(user.id, new_lang)` | **Catalog switch + seed** |
| **OAuth new user** | `auth_service.py:242` | `ensure_user_seeded` | Full seed |
| **OAuth existing** | `auth_service.py:244` | `ensure_primary_member` only | No seed |
| **Exchange code** | `exchange_code` | No direct seed | Token only |
| **Admin CLI** | `app/scripts/seed_global_catalog.py` | `import_global_catalog(session, lang)` | Idempotent system catalog |

`ensure_catalog_if_incomplete` → if no recipes for user+lang → `ensure_user_seeded` → `_ensure_global_catalog` + `_seed_recipes`.

**Violations vs target:** seed on login, /me, and language change must be removed.

---

## 11. System vs user product model (current)

### `users`
- `lang: str` (pl|en) — **conflates UI + market**

### `products`
- `user_id` NULL + `source='system'` → global catalog row per `lang`
- `user_id` set → private user product, `lang` column
- `catalog_key` — stable key for system rows (`seed:{lang}:{index}:{slug}`)
- `base_product_id` — link to customized system product
- Unique: `(lang, catalog_key)` where system

### `recipes`
- Per-user, filtered by `lang` column
- Demo recipes seeded per user+lang on register

**No `markets` table. No `market_code` column. No `ui_locale`.**

---

## 12. Meaning of current EN catalog

| Evidence | Finding |
|----------|---------|
| `products_seed_en.json` | English names (`natural yogurt`), prices ~£1.20–1.50 scale |
| `products_seed_pl.json` | Polish names, prices ~4–5 PLN scale |
| `fuel_service.py` | `lang=en` → `_fetch_uk()` (gov.uk CSV) |
| `data/dish_compare/defaults/en.json` | `"currency": "GBP"` |
| `data/dish_compare/defaults/pl.json` | `"currency": "PLN"` |
| i18n showcase (PL) | Mentions Auchan, Biedronka |
| i18n showcase (EN) | Generic “Auchan and Biedronka” → English stores wording |

### Conclusion

| `lang` value | Recommended `market_code` | Currency | Notes |
|--------------|---------------------------|----------|-------|
| `pl` | `PL` | PLN | Polish retail catalog |
| `en` | **`GB`** | **GBP** | UK fuel scrape, GBP dish-compare — **not US** |

**Do not map `en` → `US` without data review.** If a generic international catalog is needed later, use explicit `INTL_EN` and document as tech debt.

Current dev seeds (`backend/data/seeds/products_seed_*.json`) contain only **2 products each** — full catalog loaded via `import_global_catalog` from seed files + scraper pipeline (separate from this audit).

---

## 13. Data loss risks

| Risk | Mitigation |
|------|------------|
| Backfill `market_code` from `lang` incorrectly | Use evidence table §12; `pl→PL`, `en→GB`; no auto `en→US` |
| Dropping `users.lang` too early | Keep `lang` during rollout; add `ui_locale` + `market_code`; dual-read period |
| Migrating products to `market_code` | ALTER `products.lang` semantics or add column + backfill; preserve `user_id` rows |
| Re-seed on migration | Remove seed from request path **before** mass backfill |
| User A sees User B products | Existing tests in `test_product_catalog_safety_net.py` — extend |
| Duplicate system catalog rows | `catalog_key` unique per lang — extend to `market_code` |
| Recipe loss on market switch | Recipes are per `lang`; changing market may need copy or filter — **document UX** |

---

## 14. Feature parity table

| Element | CRA | Next.js | Status | User impact | Action | Branch |
|---------|-----|---------|--------|-------------|--------|--------|
| Tab / URL navigation | tabs | App Router | complete | Low | — | — |
| Auth password | ✅ | ✅ | complete | — | — | — |
| Google OAuth | ✅ | ✅ | complete | — | — | — |
| Members | ✅ | ✅ | complete | — | — | — |
| Products API | ✅ | ✅ | complete | — | — | — |
| Recipes API | ✅ | ✅ | complete | — | — | — |
| Calendar DnD | ✅ | ✅ | complete | — | Edge audit | `feat/parity-calendar-audit` |
| Schedule bulk | ✅ | ✅ | complete | — | Edge audit | `feat/parity-schedule-audit` |
| Summary + drinks | ✅ | ✅ | complete | — | Visual pass | `feat/visual-parity-summary-export` |
| Export 7 docs | ✅ | ✅ | complete | — | Visual pass | `feat/visual-parity-summary-export` |
| Macro + save profile | ✅ | ✅ | complete | — | Visual + TS | `feat/visual-parity-macro` |
| Joyride tour | ✅ | ✅ | complete | — | — | — |
| Login showcase | ✅ | ❌ | **missing** | **High** | Port | `feat/visual-parity-login` |
| Viewport scaling | ✅ | ❌ | **missing** | Medium | Port | `feat/visual-parity-app-shell` |
| UI locale ≠ market | ❌ (conflated) | ❌ | **missing** | **High** | Backend+FE | `refactor/separate-ui-locale-and-market` |
| No seed on /me/login/lang | ❌ (seeds) | ❌ | **missing** | Medium | Backend | `refactor/separate-ui-locale-and-market` |
| BFF cookies | — | opt-in | intentionally deferred | Low | — | done |

---

## 15. Visual parity table

| Screen / component | CRA file | Next.js file | Status | Visible difference | Action | Branch |
|--------------------|----------|--------------|--------|-------------------|--------|--------|
| **App shell** | `App.js`, `App.css`, `AppBackground.*` | `AppShell.tsx` | **missing/partial** | Flat dark bg, no glow/grid | Port shell | `feat/visual-parity-app-shell` |
| **AppFooter** | `AppFooter.js` | fragments | **missing** | No copyright on login | Port | `feat/visual-parity-app-shell` |
| **Desktop scaling** | `desktopLayout.css`, `useLayoutViewport` | — | **missing** | Mobile layout differs | Port | `feat/visual-parity-app-shell` |
| **Sidebar** | `App.css` | `Sidebar.tsx` | **partial** | Width, colors, hover | Port CSS | `feat/visual-parity-sidebar` |
| **Login page** | `Login.js`, `Login.css` | `LoginForm.tsx` | **missing** | Card vs full marketing page | Full port | `feat/visual-parity-login` |
| **Welcome** | `Welcome.css` | `WelcomeScreen.tsx` | **partial** | Tiles/footer layout | Wire CSS | `feat/visual-parity-welcome` |
| **Products** | `Products.css` | `ProductsScreen.tsx` | **partial** | Tailwind vs CRA lists | Port CSS | `feat/visual-parity-products` |
| **Recipes** | `Recipes.css` | `RecipesScreen.tsx` | **partial** | Tailwind vs CRA editor | Port CSS | `feat/visual-parity-recipes` |
| **MemberToggles** | `MemberToggles.css` | `MemberToggles.tsx` | **partial** | Chip styling | Port CSS | `feat/visual-parity-member-toggles` |
| **Macro** | `MacroCalculator.css` | `MacroScreen.tsx` | **partial** | Inline styles | Port + TS | `feat/visual-parity-macro` |
| **Calendar** | `Calendar.css` | `calendar.css` | **partial** | Mostly OK | Audit + polish | `feat/visual-parity-calendar` |
| **Schedule** | `DaySchedule.css` | `day-schedule.css` | **partial** | Mostly OK | Polish | `feat/visual-parity-schedule` |
| **Summary** | inline + modules | `summary.css` | **partial** | — | Polish | `feat/visual-parity-summary-export` |
| **Export** | `Export.css` | `export.css` | **partial** | — | Polish | `feat/visual-parity-summary-export` |
| **Profile** | `Profile.js` inline | `ProfileModal.tsx` Tailwind | **partial** | Modal styling | Port | `feat/visual-parity-profile-privacy` |
| **Privacy** | `PrivacyPolicy.js` | `PrivacyPolicyModal.tsx` | **partial** | — | Port | `feat/visual-parity-profile-privacy` |
| **DishCompare** | `Login.css` | `dish-compare.css` | **partial** | On simplified login | With login task | `feat/visual-parity-login` |
| **Global polish** | `index.css` | `globals.css` | **partial** | Scrollbars, favicon | Final pass | `feat/visual-parity-global-polish` |

---

## 16. i18n / market parity table (target state)

| Capability | Current | Target | Branch |
|------------|---------|--------|--------|
| UI strings PL/EN | `translations.ts` monolith | `messages/{pl,en}/*.json` | `refactor/i18n-modular-messages` |
| `ui_locale` on user | ❌ (`lang`) | `users.ui_locale` | `refactor/separate-ui-locale-and-market` |
| `market_code` on user | ❌ (`lang`) | `users.market_code` | `refactor/separate-ui-locale-and-market` |
| Lang switch → UI only | ❌ (also seeds catalog) | ✅ | same |
| Market switch → catalog only | ❌ (no UI) | Profile/settings | `feat/parity-market-settings-ui` |
| `html lang` attribute | inconsistent | `user.ui_locale` | `refactor/i18n-modular-messages` |
| Currency display | implicit via lang | `markets.currency_code` | backend refactor |
| Key parity PL/EN | manual | CI validation test | `refactor/i18n-modular-messages` |
| No `@ts-nocheck` on i18n | ❌ | ✅ | `refactor/i18n-modular-messages` |

---

## 17. Roadmap — branch by branch

### Phase 0 — Audit (this document)
- **Branch:** none (docs only)
- **Deliverable:** `docs/CRA_NEXT_VISUAL_AND_I18N_AUDIT.md` ✅

### Phase 1 — CRA reference restore
| Field | Value |
|-------|-------|
| **Branch** | `chore/restore-cra-reference` |
| **Scope** | Restore `frontend/src/`, `frontend/public/`, `frontend/package.json` from `dca8eb9`; add `frontend/README.md` (reference only); add `docs/CRA_REFERENCE.md` |
| **CRA** | `dca8eb9:frontend/**` |
| **Next** | docs only |
| **Acceptance** | CRA reference buildable locally on alternate port; compose still uses `frontend-next`; Railway unchanged |
| **Tests** | `cd frontend && npm ci && npm run build` (optional CI job `allow-failure` or manual) |
| **Out of scope** | Production cutover, compose switch |

### Phase 2 — UI locale / market separation (backend + frontend API)
| Field | Value |
|-------|-------|
| **Branch** | `refactor/separate-ui-locale-and-market` |
| **Scope** | Alembic: `ui_locale`, `market_code`, `markets` table; backfill `pl→PL`, `en→GB`; keep `users.lang`; remove seed from login/me/language; admin seed CLI only; API: `PATCH /auth/language` → ui_locale only; new `PATCH /auth/market` |
| **CRA** | N/A |
| **Next** | `AuthContext`, `ProfileModal`, `lib/api/auth.ts`, types |
| **Acceptance** | 12 backend tests from spec §TESTY BACKENDU; lang change does not seed |
| **Out of scope** | Visual parity, i18n file split |

### Phase 3 — Modular i18n
| Field | Value |
|-------|-------|
| **Branch** | `refactor/i18n-modular-messages` |
| **Scope** | Split `translations.ts` → `messages/`; remove `@ts-nocheck`; key parity test; `html lang` |
| **Acceptance** | typecheck strict; missing key fails CI |
| **Out of scope** | next-intl route prefixes `/pl` `/en` |

### Phase 4 — Visual parity (order matters)

| # | Branch | CRA source | Next target |
|---|--------|------------|-------------|
| 4a | `feat/visual-parity-app-shell` | `App.css`, `AppBackground.*`, `desktopLayout.css`, `useLayoutViewport`, `AppFooter` | `AppShell`, `globals.css`, new layout CSS |
| 4b | `feat/visual-parity-sidebar` | `App.css` sidebar | `Sidebar.tsx` |
| 4c | `feat/visual-parity-login` | `Login.js`, `Login.css`, `public/demos/` | `app/login/`, `LoginForm`, assets |
| 4d | `feat/visual-parity-welcome` | `Welcome.css`, `WelcomeMembers.css` | `WelcomeScreen.tsx` |
| 4e | `feat/visual-parity-products` | `Products.css` | `ProductsScreen.tsx` + market_code display |
| 4f | `feat/visual-parity-recipes` | `Recipes.css` | `RecipesScreen.tsx` |
| 4g | `feat/visual-parity-member-toggles` | `MemberToggles.css` | `MemberToggles.tsx` |
| 4h | `feat/visual-parity-macro` | `MacroCalculator.css` | `MacroScreen.tsx`, remove `@ts-nocheck` |
| 4i | `feat/visual-parity-calendar` | `Calendar.css` | `CalendarScreen.tsx` |
| 4j | `feat/visual-parity-schedule` | `DaySchedule.css` | `DayScheduleScreen.tsx` |
| 4k | `feat/visual-parity-summary-export` | `Summary.js`, `Export.css`, `DrinksCard.js` | summary + export modules |
| 4l | `feat/visual-parity-profile-privacy` | `Profile.js`, `PrivacyPolicy.js` | modals |
| 4m | `feat/visual-parity-global-polish` | `index.css`, `favicon.svg` | `globals.css`, `public/` |

### Phase 5 — Market settings UI
| Field | Value |
|-------|-------|
| **Branch** | `feat/parity-market-settings-ui` |
| **Scope** | Profile: separate UI language vs market; warning modals; products refresh on market change only |
| **Depends on** | Phase 2 |

### Phase 6 — Tests & cleanup
| Branch | Scope |
|--------|-------|
| `test/e2e-module-smoke` | Playwright logged-in module loads |
| `test/e2e-visual-screenshots` | 4 viewports × core screens |
| `chore/remove-dead-scaffold` | ModulePlaceholder, HomeScreen, etc. |
| `chore/typescript-parity-export` | Remove `@ts-nocheck` incrementally |

### Phase 7 — Final report
| Field | Value |
|-------|-------|
| **Branch** | `docs/cra-next-final-parity-report` |
| **Deliverable** | `docs/CRA_NEXT_FINAL_PARITY_REPORT.md` |

---

## 18. Per-branch verification checklist (template)

Each visual branch must:

1. Extract UI checklist from CRA component (grep class names, sections).
2. Port CSS/classes — **no new design**.
3. Run `npm run test && lint && typecheck && build`.
4. Playwright screenshots: 1440×900, 1280×800, 768×1024, 375×812 — CRA vs Next before/after.
5. Manual PL + EN.
6. Report per §FORMAT RAPORTU KOŃCOWEGO (branch README or PR body).

**Rejected as parity:** missing sections, placeholder substitutes, arbitrary Tailwind restyle, missing assets.

**Accepted differences:** URL routing vs tabs, a11y fixes, bug fixes without visual intent change.

---

## 19. `@ts-nocheck` inventory (must clear)

| File | Lines | Branch to fix |
|------|-------|---------------|
| `lib/i18n/translations.ts` | 1905 | `refactor/i18n-modular-messages` |
| `components/macro/MacroScreen.tsx` | 540 | `feat/visual-parity-macro` |
| `components/export/ExportScreen.tsx` | 1340 | `feat/visual-parity-summary-export` |
| `components/summary/DrinksCard.tsx` | 1246 | `feat/visual-parity-summary-export` |
| `components/dish-compare/DishCompare.tsx` | 317 | `feat/visual-parity-login` |

---

## 20. Next immediate task

**Start:** `chore/restore-cra-reference`  
**Then:** `refactor/separate-ui-locale-and-market` (data model before visual work on Products)  
**Parallel track after shell:** `feat/visual-parity-app-shell` → `feat/visual-parity-login` (biggest visual win)

---

## References

- CRA snapshot: `git show dca8eb9:frontend/src/<file>`
- Migration plan (tasks 1–16): `docs/FRONTEND_NEXT_MIGRATION_PLAN.md`
- Product catalog tests: `backend/tests/contract/test_product_catalog_safety_net.py`
- Auth + seed: `backend/app/services/auth_service.py`, `catalog_seed_service.py`
- Seed CLI: `backend/app/scripts/seed_global_catalog.py`
