> **HISTORICAL DOCUMENT** — Archived CRA_NEXT_FINAL_PARITY_REPORT.md. For current state see [`docs/CURRENT_STATE.md`](../../CURRENT_STATE.md).

# CRA → Next.js: Final Parity Report

**Date:** 2026-06-25  
**CRA reference commit:** `dca8eb9` (restored on `main` in `frontend/src/`)  
**Production frontend:** `frontend-next/` (Next.js App Router)  
**Epic:** Phases 0–7 of `docs/CRA_NEXT_VISUAL_AND_I18N_AUDIT.md`  
**Last merged PR:** #83 — `chore/drop-users-lang-column` (legacy `users.lang` dropped)

---

## 1. Executive summary

The CRA → Next.js migration epic is **functionally complete** and **visually aligned** with the CRA reference for all primary screens. Backend separation of `ui_locale` and `market_code` is implemented and covered by contract tests. E2E smoke and visual regression suites run in CI.

**Remaining technical debt (non-blocking):**

| Item | Severity | Status |
|------|----------|--------|
| BFF + HttpOnly cookies | Deferred | opt-in via env flag (task 16, merged #56) |
| CRA-vs-Next live diff job (not just self-baselines) | Low | optional (TD-5) |
| BFF production cutover decision | Product | optional (TD-6) |

All TypeScript `@ts-nocheck` removed from `frontend-next/`. EN demo WebM assets shipped. Legacy `users.lang` column dropped (Alembic `f1a2b3c4d5e6`).

---

## 2. Merged branches (Phases 0–7)

| Phase | PR | Branch | Status |
|-------|-----|--------|--------|
| 0 | — | audit doc | ✅ |
| 1 | #58 | `chore/restore-cra-reference` | ✅ merged |
| 2 | #59 | `refactor/separate-ui-locale-and-market` | ✅ merged |
| 3 | #60 | `refactor/i18n-modular-messages` | ✅ merged |
| 4a | #61 | `feat/visual-parity-app-shell` | ✅ merged |
| 4b | #62 | `feat/visual-parity-sidebar` | ✅ merged |
| 4c | #63 | `feat/visual-parity-login` | ✅ merged |
| 4d | #66 | `feat/visual-parity-welcome` | ✅ merged |
| 4e | #65 | `feat/visual-parity-products` | ✅ merged |
| 4f | #67 | `feat/visual-parity-recipes` | ✅ merged |
| 4g | — | `feat/visual-parity-member-toggles` | ✅ (CSS in `member-toggles.css`, shipped with sidebar/welcome work) |
| 4h | #68 | `feat/visual-parity-macro` | ✅ merged |
| 4i | #69 | `feat/visual-parity-calendar` | ✅ merged |
| 4j | #70 | `feat/visual-parity-schedule` | ✅ merged |
| 4k | #71 | `feat/visual-parity-summary-export` | ✅ merged |
| 4l | #72 | `feat/visual-parity-profile-privacy` | ✅ merged |
| 4m | #73 | `feat/visual-parity-global-polish` | ✅ merged |
| 5 | #74 | `feat/parity-market-settings-ui` | ✅ merged |
| 6a | #75 | `test/e2e-module-smoke` | ✅ merged |
| 6b | #76 | `test/e2e-visual-screenshots` | ✅ merged |
| 6c | #77 | `chore/remove-dead-scaffold` | ✅ merged |
| 6d | #78 | `chore/typescript-parity-export` | ✅ merged |
| 7 | #79 | `docs/cra-next-final-parity-report` | ✅ merged |
| TD-2 | #80 | `chore/typescript-parity-dish-compare` | ✅ merged |
| TD-1 | #81 | `chore/typescript-parity-drinks-card` | ✅ merged |
| TD-3 | #82 | `chore/en-demo-webm-assets` | ✅ merged |
| TD-4 | #83 | `chore/drop-users-lang-column` | ✅ merged |

---

## 3. Feature parity

| Element | CRA | Next.js | Status | Notes |
|---------|-----|---------|--------|-------|
| App Router / URL navigation | tabs | routes | ✅ complete | Accepted architectural difference |
| Auth (password) | ✅ | ✅ | ✅ | |
| Google OAuth | ✅ | ✅ | ✅ | |
| Household members | ✅ | ✅ | ✅ | |
| Products CRUD + import | ✅ | ✅ | ✅ | Global catalog + user overrides |
| Recipes parse + editor | ✅ | ✅ | ✅ | |
| Calendar DnD | ✅ | ✅ | ✅ | |
| Day schedule bulk ops | ✅ | ✅ | ✅ | |
| Summary + drinks | ✅ | ✅ | ✅ | |
| Export (7 print docs) | ✅ | ✅ | ✅ | |
| Macro calculator + profile save | ✅ | ✅ | ✅ | |
| Joyride tour | ✅ | ✅ | ✅ | |
| Dish compare (public) | ✅ | ✅ | ✅ | On login page |
| Login showcase + demos | ✅ | ✅ | ✅ | 7× PL + 7× EN WebM in `public/demos/` |
| `ui_locale` ≠ `market_code` | ❌ (conflated) | ✅ | ✅ | Phase 2 |
| Market selector in Profile | ❌ | ✅ | ✅ | Phase 5 — PL / GB |
| No seed on login / me / lang change | ❌ | ✅ | ✅ | Seed on register only + admin CLI |
| BFF HttpOnly cookies | — | opt-in | ⏸ deferred | `NEXT_PUBLIC_USE_BFF=1` |
| E2E module smoke | — | ✅ | ✅ | 8 logged-in routes |
| E2E visual regression | — | ✅ | ✅ | 36 baselines, 4 viewports |

---

## 4. Visual parity (per screen)

| Screen | CRA source | Next.js | Status | Residual drift |
|--------|------------|---------|--------|----------------|
| App shell | `App.css`, `AppBackground.*`, `desktopLayout.css` | `AppShell.tsx`, layout CSS | ✅ | URL routing vs tabs |
| Sidebar | `App.css` | `Sidebar.tsx` + CSS | ✅ | Minor responsive tweaks |
| Login | `Login.js`, `Login.css` | `LoginForm.tsx` + CSS | ✅ | DishCompare embedded in simplified layout |
| Welcome | `Welcome.css` | `WelcomeScreen.tsx` | ✅ | |
| Products | `Products.css` | `ProductsScreen.tsx` + CSS | ✅ | |
| Recipes | `Recipes.css` | `RecipesScreen.tsx` + CSS | ✅ | |
| MemberToggles | `MemberToggles.css` | `member-toggles.css` | ✅ | |
| Macro | `MacroCalculator.css` | `MacroScreen.tsx` | ✅ | `@ts-nocheck` removed |
| Calendar | `Calendar.css` | `calendar.css` | ✅ | |
| Schedule | `DaySchedule.css` | `day-schedule.css` | ✅ | |
| Summary | inline + modules | `summary.css` | ✅ | DrinksCard strict TS (PR #81) |
| Export | `Export.css` | `export.css` | ✅ | TS strict (PR #78) |
| Profile | `Profile.js` | `ProfileModal.tsx` + CSS | ✅ | |
| Privacy | `PrivacyPolicy.js` | `PrivacyPolicyModal.tsx` | ✅ | |
| Global polish | `index.css`, `favicon.svg` | `globals.css`, `favicon.svg` | ✅ | Dark scrollbars sitewide |

**Visual regression coverage:** Playwright compares Next.js screenshots against committed baselines (not live CRA). Baselines were captured after visual parity branches landed; CI enforces `maxDiffPixelRatio: 0.04`.

Screens × viewports in CI:

- `login`, `home`, `macro`, `calendar`, `schedule`, `recipes`, `products`, `summary`, `export`
- Viewports: 1440×900, 1280×800, 768×1024, 375×812 → **36 PNG baselines**

---

## 5. i18n / market parity

| Capability | Before epic | After epic | Status |
|------------|-------------|------------|--------|
| UI strings PL/EN | `translations.ts` monolith + `@ts-nocheck` | `lib/i18n/messages/{pl,en}/*.ts` | ✅ |
| Key parity PL ↔ EN | manual | `tests/unit/i18n-key-parity.test.ts` | ✅ |
| `users.ui_locale` | ❌ (`lang` only) | ✅ column + API | ✅ |
| `users.market_code` | ❌ | ✅ `PL` / `GB` | ✅ |
| Lang switch → UI only | ❌ (also seeded catalog) | ✅ `PATCH /auth/language` | ✅ |
| Market switch → catalog filter | ❌ | ✅ `PATCH /auth/market` + hook reload | ✅ |
| Product list uses `market_code` | ❌ (`lang`) | ✅ contract tests | ✅ |
| `html lang` attribute | inconsistent | from `ui_locale` | ✅ |
| `@ts-nocheck` on i18n | ❌ | removed | ✅ |

### Market behaviour

| Market | Currency (implicit) | Catalog | Fuel source | Dish compare |
|--------|---------------------|---------|-------------|--------------|
| `PL` | PLN | Polish retail seed | Poland scrape | `pl.json` / PLN |
| `GB` | GBP | English/UK seed | UK gov.uk | `en.json` / GBP |

`US` is rejected by API (`Invalid market`). Default mapping: `pl` → `PL`, `en` → `GB`.

### PL / EN behaviour (verified)

- **PL:** UI from `messages/pl/*`; default market `PL`; showcase copy references Polish retailers.
- **EN:** UI from `messages/en/*`; default market `GB` on register with `ui_locale=en`; changing UI language does not change market unless user confirms market switch in Profile.
- **Profile:** separate toggles for UI language and product market; market change shows warning and reloads product-dependent hooks (`useProductsPage`, `useRecipesPage`, `useCalendarPage`, `useSummaryPage`, `useWelcomeStats`).

---

## 6. Data migration & seeding status

### Schema

- `users.ui_locale` and `users.market_code` on `users`; legacy `users.lang` dropped (Alembic `f1a2b3c4d5e6`). API still returns `"lang"` from `ui_locale` for backward compat.
- `markets` reference table with `PL`, `GB`.
- Products: global system catalog (`user_id IS NULL`, `source='system'`) + per-user overrides; filtered by `market_code` (not `ui_locale`).

### Seed triggers (current)

| Trigger | Seeds? | Notes |
|---------|--------|-------|
| Register | ✅ once | `ensure_primary_member` only in auth path; catalog via worker/registration flow |
| Login | ❌ | `sync_primary_member_name` only |
| `GET /me` | ❌ | Returns user dict only |
| `PATCH /auth/language` | ❌ | `apply_ui_locale` only |
| `PATCH /auth/market` | ❌ | `apply_market_code` only |
| Admin CLI | ✅ | `seed_global_catalog.py` — idempotent |

`ensure_catalog_if_incomplete` / `ensure_user_seeded` remain in `catalog_seed_service.py` for worker and explicit test use — **not** called from login/me/language paths.

---

## 7. Test results (2026-06-25, `main` after #78)

| Suite | Command | Result |
|-------|---------|--------|
| Frontend unit (Vitest) | `cd frontend-next && npm run test` | **33/33 passed** (12 files) |
| Frontend lint | `npm run lint` | pass (CI) |
| Frontend typecheck | `npm run typecheck` | pass (CI) |
| Frontend build | `npm run build` | pass (CI) |
| Playwright E2E | `npm run test:e2e` | **47 tests** — 3 smoke + 8 module smoke + 36 visual (CI green on #78) |
| Backend | `cd backend && uv run pytest` | **156 tests** collected (CI green) |

### E2E breakdown

| File | Tests | Purpose |
|------|-------|---------|
| `smoke.spec.ts` | 3 | Auth flows (mock API) |
| `modules-smoke.spec.ts` | 8 | Logged-in route markers |
| `visual-screenshots.spec.ts` | 36 | Screenshot regression |

Visual tests use fixed clock, skip tour, mock FastAPI session (`helpers/mock-api.ts`), and `waitForScreenReady()` for export preview stability.

---

## 8. Accepted differences (CRA vs Next.js)

These are **intentional** and not parity defects:

1. **Navigation:** App Router URLs (`/products`) instead of in-app tabs.
2. **Framework:** Next.js SSR/hydration, `next/image` where used, React 19.
3. **i18n loading:** Modular TS message modules instead of single `LanguageContext` blob (same keys).
4. **Auth transport:** JWT in `localStorage` by default; optional BFF cookies behind feature flag.
5. **Demo videos:** PL and EN WebM copies in `public/demos/` (EN initially duplicated from PL; replace with native EN recordings when available).
6. **TypeScript:** All ported modules strict — zero `@ts-nocheck` in `frontend-next/`.
7. **Removed scaffold:** `HomeScreen`, `ModulePlaceholder`, `ProviderDemo`, `HealthStatus` — never in CRA production UX.
8. **a11y:** Minor semantic HTML / focus improvements where they do not change visual design.

---

## 9. Per-branch summary (§FORMAT RAPORTU KOŃCOWEGO)

Condensed rollup of all epic branches. Full diffs: GitHub PRs #58–#78.

### Phase 1 — `chore/restore-cra-reference` (#58)

- **Goal:** Restore CRA source tree for side-by-side comparison.
- **CRA ref:** `dca8eb9:frontend/**`
- **Change:** `frontend/src/`, `frontend/public/`, `docs/CRA_REFERENCE.md`
- **Tests:** CRA `npm run build` (reference only; production = `frontend-next`)

### Phase 2 — `refactor/separate-ui-locale-and-market` (#59)

- **Goal:** Split UI language from product market; stop request-path seeding.
- **Change:** Alembic migration, `ui_locale` / `market_code` on `User`, API `PATCH /auth/market`, auth service refactor.
- **Tests:** `test_ui_locale_market.py`, `test_auth_contract.py` — lang change does not alter market or seed.

### Phase 3 — `refactor/i18n-modular-messages` (#60)

- **Goal:** Split monolith `translations.ts`, remove `@ts-nocheck`, key parity CI.
- **Change:** `lib/i18n/messages/{pl,en}/*.ts`, `i18n-key-parity.test.ts`
- **Tests:** typecheck strict; 2 parity tests pass.

### Phase 4 — Visual parity (#61–#73)

- **Goal:** Port CRA CSS/layout/assets screen by screen.
- **CRA ref:** per-screen `.css` + `.js` from `frontend/src/`
- **Highlights:** login showcase + 7 WebM demos, app background/grid, sidebar 220px chrome, module CSS modules, profile/privacy modals, favicon SVG, global scrollbars.
- **Screenshots:** baselines added in Phase 6b; all green in CI.

### Phase 5 — `feat/parity-market-settings-ui` (#74)

- **Goal:** Profile UI for market selection independent of UI language.
- **Change:** `ProfileModal` market section, `updateUserMarket`, hook reload on `market_code`.
- **PL/EN:** both supported; market warning modal before switch.

### Phase 6 — Tests & cleanup (#75–#78)

| Branch | Deliverable |
|--------|-------------|
| `test/e2e-module-smoke` | 8 authenticated route smokes |
| `test/e2e-visual-screenshots` | 36 baselines, 4 viewports |
| `chore/remove-dead-scaffold` | Deleted 4 unused components |
| `chore/typescript-parity-export` | `ExportScreen.tsx` strict TS |

### Phase 7 — Documentation & follow-up debt (#79–#83)

| PR | Branch | Deliverable |
|----|--------|-------------|
| #79 | `docs/cra-next-final-parity-report` | Epic closure documentation |
| #80 | `chore/typescript-parity-dish-compare` | `DishCompare.tsx` strict TS |
| #81 | `chore/typescript-parity-drinks-card` | `DrinksCard.tsx` strict TS (~1247 lines) |
| #82 | `chore/en-demo-webm-assets` | 7× `*.en.webm` demo videos |
| #83 | `chore/drop-users-lang-column` | Drop `users.lang`; bump alembic head |

---

## 10. Remaining technical debt

| ID | Description | Effort | Priority | Status |
|----|-------------|--------|----------|--------|
| TD-1 | `DrinksCard.tsx` — remove `@ts-nocheck` | Large | P2 | ✅ #81 |
| TD-2 | `DishCompare.tsx` — remove `@ts-nocheck` | Small | P3 | ✅ #80 |
| TD-3 | EN demo WebM assets | Small | P3 | ✅ #82 |
| TD-4 | Drop legacy `users.lang` column | Medium | P3 | ✅ #83 |
| TD-5 | Optional: CRA-vs-Next live diff job (not just self-baselines) | Medium | P3 | open |
| TD-6 | BFF production cutover decision | Product | P3 | open |

---

## 11. Production deployment notes

- **Railway frontend service:** `frontend-next/` (CRA removed in #55).
- **Docker:** `frontend-next` on port 3002; CI runs lint, typecheck, unit, e2e, docker build.
- **CRA reference:** `frontend/` builds locally for comparison; not deployed.

---

## 12. Sign-off checklist

| Criterion | Met |
|-----------|-----|
| All modules routed and functional | ✅ |
| Visual parity branches merged (4a–4m) | ✅ |
| `ui_locale` / `market_code` separated | ✅ |
| Seed removed from login/me/lang | ✅ |
| i18n modular + key parity test | ✅ |
| E2E smoke + visual CI | ✅ |
| Dead scaffold removed | ✅ |
| ExportScreen TypeScript strict | ✅ |
| DrinksCard + DishCompare TypeScript strict | ✅ |
| EN demo WebM assets | ✅ |
| Legacy `users.lang` column dropped | ✅ |
| Final report published | ✅ |

**Epic status: COMPLETE** — all planned parity work and follow-up debt TD-1–TD-4 resolved.

---

## References

- Initial audit: `docs/CRA_NEXT_VISUAL_AND_I18N_AUDIT.md`
- CRA reference guide: `docs/CRA_REFERENCE.md`
- Migration plan (tasks 1–16): `docs/FRONTEND_NEXT_MIGRATION_PLAN.md`
- CRA snapshot: `git show dca8eb9:frontend/src/<file>`
- Backend market tests: `backend/tests/contract/test_ui_locale_market.py`
- Product catalog safety: `backend/tests/contract/test_product_catalog_safety_net.py`
