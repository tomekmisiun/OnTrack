# CRA → Next.js: Full Regression Audit

**Date:** 2026-06-25  
**Auditor:** Cursor Agent (read-only audit task)  
**Scope:** Post-migration regression — auth, feature parity, API, DB, UI, i18n, CI  
**CRA reference:** `frontend/src/` (restored on `main`, commit `dca8eb9` baseline per `docs/CRA_REFERENCE.md`)  
**Next.js production frontend:** `frontend-next/`  
**Backend:** FastAPI `backend/` + Alembic head `f1a2b3c4d5e6`

---

## Instructions read (binding / context)

| Source | Read | Notes |
|--------|------|-------|
| `AGENTS.md` | ✅ | Index to `.ai-rules/` |
| `CLAUDE.md` | ✅ | Same index |
| `.cursor/rules/ontrack.mdc` | ✅ | API contract, no push to main |
| `.cursor/rules/project.mdc` | ✅ | (via glob) |
| `.cursor/rules/frontend.mdc` | ✅ | Frontend conventions |
| `.cursor/rules/backend.mdc` | ✅ | Backend conventions |
| `.cursor/rules/testing.mdc` | ✅ | Points to `.ai-rules/testing.md` |
| `.cursor/rules/workflow.mdc` | ✅ | PR workflow |
| `.cursor/rules/security.mdc` | ✅ | Secrets policy |
| `.cursor/rules/docker.mdc` | ✅ | Compose safety |
| `.cursor/rules/documentation.mdc` | ✅ | Docs conventions |
| `README.md` | ✅ | Quick start, env vars, test commands |
| `docs/CRA_NEXT_FINAL_PARITY_REPORT.md` | ✅ | Claims epic COMPLETE |
| `docs/CRA_NEXT_VISUAL_AND_I18N_AUDIT.md` | ✅ | Original audit (pre-parity branches) |
| `docs/FRONTEND_NEXT_MIGRATION_PLAN.md` | ✅ | Tasks 1–16 |
| `docs/FRONTEND_NEXT_BFF.md` | ✅ | Opt-in BFF |
| `docs/backend-migration/API_CONTRACT.md` | ✅ | Referenced via ontrack rule |
| `docs/PROJECT_TECHNICAL_AUDIT.md` | ✅ | Cross-check |
| `.github/DEPLOY.md` | ✅ | Railway + CI |
| `.ai-rules/repository.md` | ✅ | Scope (via AGENTS index) |

---

## 1. Executive Summary

**The CRA → Next.js migration epic must not be considered complete.** Formal parity reports (#79–#84) and green CI do **not** prove end-to-end product readiness.

| Question | Verdict |
|----------|---------|
| Migration functionally complete? | **NO** — confirmed regressions and environment-dependent auth failures |
| Real feature parity with CRA? | **PARTIAL** — screens exist; landing widget and deploy path gaps remain |
| Auth works end-to-end? | **UNVERIFIED live** — backend contract tests pass; no E2E against real API; production misconfig is a documented failure mode |
| Safe to deploy? | **NO** until prod DB migrations verified + `NEXT_PUBLIC_API_URL` / `FRONTEND_URL` validated |
| CRA safe to remove? | **NO** |
| Epic closure justified? | **NO** |

### Top blockers (summary)

1. **No automated E2E for real register/login** — CI can be green while auth is broken in production (`TEST-001`).
2. **Production DB migrations are manual** — `start-production.sh` does not run Alembic; schema drift after #83 can break auth (`MIG-001`).
3. **DishCompare landing widget silently disappears** when public API is unreachable (`PARITY-001`, `UI-001`).
4. **Deploy/env coupling** — auth requires correct build-time `NEXT_PUBLIC_API_URL` and runtime `FRONTEND_URL` CORS (`AUTH-001`, `AUTH-002`).
5. **Full-stack local reproduction failed** in this audit environment (port conflicts, Postgres credentials) — live flows **not re-validated** here (`ENV-001`).

---

## 2. Reproduction Results

### Environment used

| Attempt | Command / action | Result |
|---------|------------------|--------|
| Docker Compose | `docker compose up -d db redis backend frontend` | **FAILED** — ports `5432` / `6379` already allocated on host |
| Backend local | `uv run alembic upgrade head` + `uvicorn` with default `.env` DATABASE_URL | **FAILED** — `password authentication failed for user "user"` against host Postgres |
| Health check | `curl http://localhost:5001/health` | **FAILED** — connection refused (no API running) |
| Backend contract tests | `cd backend && uv run pytest` | **PASS** — 149 passed, 7 skipped |
| Frontend unit | `npm run test` | **PASS** — 33/33 |
| Frontend build | `npm run build` | **PASS** |
| Playwright E2E | `npm run test:e2e` | **PASS** — 47/47 (mocked API, no real backend) |

### Flow matrix

| Flow | Expected | Actual (this audit) | HTTP | Evidence | Severity |
|------|----------|---------------------|------|----------|----------|
| Open landing `/login` | Marketing + auth form + DishCompare widget | Form renders in E2E; DishCompare **missing on `main`** when API down; local uncommitted fix adds fallback | — | E2E snapshots on `main` showed widget absent; `DishCompare.tsx:152-154` returns `null` on error | HIGH |
| Register new account | 201 + JWT + redirect `/` | **Not reproduced live** — contract test passes | 201 in pytest | `test_auth_contract.py:71-77` | BLOCKER (live unverified) |
| Login valid credentials | 200 + JWT + session | **Not reproduced live** — contract test passes | 200 in pytest | `test_auth_contract.py:89-93` | BLOCKER (live unverified) |
| Login invalid password | 401 + error message | **Not reproduced live** — contract test passes | 401 | `test_auth_contract.py:97-106` | MEDIUM |
| Protected route w/o session | Redirect `/login?next=` | **PASS** in Playwright smoke | 302 (middleware) | `smoke.spec.ts:13-17` | — |
| Protected route after login | App shell + module | **PASS only with mocked API** | — | `modules-smoke.spec.ts` + `mock-api.ts` | CRITICAL gap |
| Logout | Clear token + return unauth | Code path present; **not live-tested** | — | `AuthContext.tsx:73-80`, `storage.ts:22-26` | MEDIUM |
| Refresh after login | Stay authenticated | Cookie `ontrack_has_token` synced from `localStorage` on bootstrap | — | `storage.ts:16-19`, `AuthContext.tsx:177-183` | UNVERIFIED live |
| PL/EN language toggle (login) | UI strings switch | Present on login panel | — | `LoginScreen.tsx:236-246` | PARITY_CONFIRMED (UI only) |
| DishCompare widget | Interactive compare carousel | **BROKEN on `main`** without reachable FastAPI | fetch fail → `null` | `lib/api/public.ts` (main), `DishCompare.tsx:152-154` | HIGH |
| Google OAuth | Redirect + exchange | **Not live-tested**; contract tests with mocks pass | 302 | `test_auth_contract.py:176-225` | UNVERIFIED |

---

## 3. Root Cause Analysis

### AUTH-001 — Production auth depends on build-time API URL (BLOCKER)

| | |
|--|--|
| **Symptom** | Register/login forms submit but fail (network/CORS) or hit wrong host |
| **Direct cause** | Browser `fetch` uses `NEXT_PUBLIC_API_URL` baked at `npm run build` |
| **Root cause** | Next.js env model + Railway deploy docs require manual alignment of `ontrackapp` build vars with `ontrack-back` public URL |
| **Files** | `frontend-next/lib/config/env.ts:5-15`, `lib/api/client.ts:16-28`, `.github/DEPLOY.md:33-47` |
| **Fix** | Verify Railway `NEXT_PUBLIC_API_URL`; add smoke test against real API post-deploy |
| **Risk** | Low for config-only fix; high if URL wrong in prod |

### AUTH-002 — CORS `FRONTEND_URL` must match browser origin (BLOCKER)

| | |
|--|--|
| **Symptom** | Preflight/CORS blocked on `/api/auth/login`, `/api/auth/register` |
| **Direct cause** | FastAPI `CORSMiddleware` allows only `FRONTEND_URL` origins |
| **Root cause** | Split frontend/backend Railway services; typo or http/https mismatch breaks all API calls |
| **Files** | `backend/app/main.py:26-33`, `backend/app/core/config.py:30` |
| **Fix** | Set `FRONTEND_URL` to exact production frontend origin(s) |
| **Risk** | Low |

### MIG-001 — Production start script does not migrate DB (BLOCKER)

| | |
|--|--|
| **Symptom** | 500 on register/login after deploy; missing columns / FK errors |
| **Direct cause** | `uvicorn` starts without `alembic upgrade head` |
| **Root cause** | Documented manual migration policy; easy to miss after PR #83 (`drop users.lang`) |
| **Files** | `backend/scripts/start-production.sh` (no alembic), `docs/PROJECT_TECHNICAL_AUDIT.md:578` |
| **Fix** | Run `alembic upgrade head` on prod/staging; consider pre-start hook or release job |
| **Risk** | Medium — wrong order can damage data; follow `docs/backend-migration/DB_REHEARSAL.md` |

### PARITY-001 / UI-001 — DishCompare hidden on API failure (HIGH)

| | |
|--|--|
| **Symptom** | Landing page missing main marketing widget (user report) |
| **Direct cause** | `DishCompare` returns `null` when `getDishCompare()` throws |
| **Root cause** | On `main`, client calls cross-origin FastAPI directly; E2E/CI run **without backend**, so widget never appeared in login visual baselines until local uncommitted fix |
| **Files** | `frontend-next/components/dish-compare/DishCompare.tsx:152-154`, `lib/api/public.ts` (main) |
| **Fix** | Same-origin Route Handler + bundled fallback (exists **uncommitted** in working tree: `app/api/public/dish-compare/route.ts`) |
| **Risk** | Low |

### TEST-001 — CI does not exercise real auth (CRITICAL)

| | |
|--|--|
| **Symptom** | Green CI while production auth broken |
| **Direct cause** | E2E uses `setupAuthenticatedMocks()` — injects fake token, mocks all API |
| **Root cause** | Smoke tests check form visibility and redirect only |
| **Files** | `tests/e2e/helpers/mock-api.ts`, `smoke.spec.ts`, `modules-smoke.spec.ts` |
| **Fix** | Add optional integration job: docker compose + Playwright real register/login |
| **Risk** | Low |

### ENV-001 — Local full-stack reproduction blocked (MEDIUM)

| | |
|--|--|
| **Symptom** | Auditor could not run docker compose or local API |
| **Direct cause** | Host ports 5432/6379 in use; Postgres password mismatch |
| **Root cause** | Environment not isolated; orphan container `ontrack-app-1` (legacy CRA stack) |
| **Evidence** | `docker compose ps -a` shows `ontrack-app-1` Exited; `ontrack-db-1` Created not Started |
| **Fix** | `docker compose down --remove-orphans`; align `.env` with running Postgres or use isolated ports |
| **Risk** | N/A (audit limitation) |

### AUTH-003 — Dual auth gate complexity (MEDIUM)

| | |
|--|--|
| **Symptom** | Edge-case redirect loops or false logouts |
| **Direct cause** | Middleware checks **cookie only** (`ontrack_has_token`); JWT in `localStorage` |
| **Root cause** | Next middleware + CRA-style localStorage JWT hybrid |
| **Files** | `middleware.ts:19-21`, `lib/auth/session-cookie.ts`, `RequireAuth.tsx` |
| **Mitigation** | `setStoredToken()` sets cookie synchronously (`storage.ts:16-19`); bootstrap on `/login` recovers cookie — **works in theory, unverified live** |
| **Risk** | Medium if cookie cleared independently of localStorage |

---

## 4. Auth Audit

### 4.1 Registration flow (code trace)

```text
LoginScreen.handleCredentials (register mode)
  → AuthContext.registerAccount
  → lib/api/auth.register → POST /api/auth/register { username, password, lang }
  → FastAPI auth.py:register → auth_service.register
  → User row + init_user_preferences(ui_locale, market_code)
  → ensure_primary_member
  → { token } (201)
  → setStoredToken → localStorage + ontrack_has_token cookie
  → fetchMeRaw → GET /api/auth/me
  → parseAuthUser → router.replace("/")
```

| Check | Status | Evidence |
|-------|--------|----------|
| Screen exists | ✅ | `/login` + register tab `LoginScreen.tsx:266-272` |
| Fields match backend | ✅ | `username`, `password`, `lang` — `RegisterRequest` `schemas/auth.py:9-12` |
| `users.lang` column dropped | ✅ | Model has `ui_locale` only `user.py:17-24`; migration `f1a2b3c4d5e6` |
| API still returns `lang` | ✅ | `user_to_dict` maps `lang` ← `ui_locale` `user_presenter.py:7-8` |
| Seed on register path only | ✅ | `test_register_does_not_seed_catalog` |
| Error handling 400/409 | ✅ | Contract tests |

### 4.2 Login flow

Same as CRA: JSON `POST /api/auth/login` → `{ token }` (not OAuth2 form). **PARITY_CONFIRMED** with `frontend/src/contexts/AuthContext.js` + `api.js`.

### 4.3 Session persistence

| Mechanism | CRA | Next.js |
|-----------|-----|---------|
| JWT storage | `localStorage.token` | `localStorage.token` (`storage.ts`) |
| Middleware | None | `ontrack_has_token=1` cookie required |
| BFF opt-in | N/A | `NEXT_PUBLIC_BFF_ENABLED=1` → HttpOnly `ontrack_session` |

### 4.4 Logout

`clearStoredToken()` clears localStorage + session cookie. BFF mode calls `DELETE /api/auth/session`.

### 4.5 Protected routes

| Layer | File | Behavior |
|-------|------|----------|
| Edge | `middleware.ts` | Cookie check; redirect to `/login?next=` |
| Client | `RequireAuth.tsx` | Waits for `user` from AuthContext |
| Route group | `app/(app)/layout.tsx` | Wraps authenticated pages |

### 4.6 Local vs production

| Variable | Local (documented) | Production risk |
|----------|-------------------|-----------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:5001` | Must be public API URL at **build** time |
| `FRONTEND_URL` | `http://localhost:3000` | Must match browser origin for CORS |
| Alembic | Manual `uv run alembic upgrade head` | **Not automated on deploy** |

---

## 5. CRA → Next.js Feature Parity Matrix

Status legend: `PARITY_CONFIRMED` | `PARTIAL` | `MISSING` | `BROKEN` | `IMPLEMENTED_DIFFERENTLY` | `DEAD_CODE` | `NOT_REACHABLE` | `UNVERIFIED`

| Area / function | CRA file | Next.js file | Status | Differences | Severity |
|---------------|----------|--------------|--------|-------------|----------|
| **Login landing** | `Login.js` | `LoginScreen.tsx` | PARTIAL | DishCompare missing when API down on `main` | HIGH |
| DishCompare widget | `DishCompare.js` | `DishCompare.tsx` | BROKEN (main) | Returns `null` on fetch error | HIGH |
| Showcase 7× WebM | `Login.js` | `LoginScreen.tsx` | PARITY_CONFIRMED | EN files are PL copies (#82) | LOW |
| dish-compare CTA card | `Login.js` | `LoginScreen.tsx` | PARITY_CONFIRMED | — | — |
| Seed stat chips | `Login.js` + `seedStats.js` | `LoginScreen.tsx` | PARITY_CONFIRMED | — | — |
| Privacy modal | `PrivacyPolicy.js` | `PrivacyPolicyModal.tsx` | PARITY_CONFIRMED | — | — |
| Google OAuth | `Login.js` | `LoginScreen.tsx` | UNVERIFIED | Same redirect URL pattern | MEDIUM |
| **Welcome / Home** | `Welcome.js` | `WelcomeScreen.tsx` | PARITY_CONFIRMED | URL `/` vs tab `home` | — |
| Welcome insight badges | `Welcome.js` + `useWelcomeStats` | same hooks | UNVERIFIED live | Logic ported | MEDIUM |
| WelcomeMembers | `WelcomeMembers.js` | `WelcomeMembers.tsx` | PARITY_CONFIRMED | — | — |
| **Macro** | `MacroCalculator.js` | `MacroScreen.tsx` | PARITY_CONFIRMED | — | — |
| **Calendar** | `Calendar.js` | `CalendarScreen.tsx` | PARTIAL | Line count ↓; visual baselines only self-compare | MEDIUM |
| **Schedule** | `DaySchedule.js` | `DayScheduleScreen.tsx` | PARTIAL | 862 vs 592 lines — verify bulk ops | MEDIUM |
| **Recipes** | `Recipes.js` | `RecipesScreen.tsx` | PARITY_CONFIRMED | Client-side parse (no server AI) same as CRA | — |
| **Products** | `Products.js` | `ProductsScreen.tsx` | PARITY_CONFIRMED | Pagination preserved | — |
| **Summary** | `Summary.js` | `SummaryScreen.tsx` | PARITY_CONFIRMED | DrinksCard typed (#81) | — |
| DrinksCard | `DrinksCard.js` | `DrinksCard.tsx` | PARITY_CONFIRMED | localStorage config | — |
| **Export** | `Export.js` | `ExportScreen.tsx` | PARITY_CONFIRMED | 7 print docs | — |
| **Profile** | `Profile.js` | `ProfileModal.tsx` | IMPLEMENTED_DIFFERENTLY | + market selector (enhancement) | — |
| **App shell / sidebar** | `App.js` | `AppShell.tsx` + `Sidebar.tsx` | PARITY_CONFIRMED | Sidebar hidden on home | — |
| **Joyride tour** | `tour-steps.js` | `TourProvider.tsx` | PARITY_CONFIRMED | — | — |
| **Member toggles** | `MemberToggles.js` | `MemberToggles.tsx` | PARITY_CONFIRMED | sidebar + welcome variants | — |
| LanguageSwitcher | N/A (lang in Profile) | `LanguageSwitcher.tsx` | DEAD_CODE | Not imported anywhere | LOW |
| HomeScreen scaffold | N/A | removed #77 | — | Intentionally removed | — |
| Tab → URL routing | in-app tabs | App Router | IMPLEMENTED_DIFFERENTLY | Accepted | — |
| BFF HttpOnly cookies | N/A | opt-in | IMPLEMENTED_DIFFERENTLY | Default off | — |

**Counts (screens + major widgets):**

| Status | Count |
|--------|-------|
| PARITY_CONFIRMED | 18 |
| PARTIAL | 3 |
| BROKEN | 1 |
| UNVERIFIED | 4 |
| IMPLEMENTED_DIFFERENTLY | 3 |
| DEAD_CODE | 1 |
| MISSING | 0 |

---

## 6. Database Migration Audit

### Chain (single head)

```text
7966d120d748 (initial)
  → c4e5f6a7b8c9d1 (global product catalog)
  → e7f8a9b0c1d2 (ui_locale, market_code, markets table)
  → f1a2b3c4d5e6 (drop users.lang)  ← HEAD
```

| Check | Result | Evidence |
|-------|--------|----------|
| Single head | ✅ | `schema_validate.py:13` = `f1a2b3c4d5e6` |
| Fresh DB upgrade | ✅ | `test_migrations_fresh.py` (integration, skipped without Postgres) |
| Stamp rehearsal | ✅ | `test_migrations_stamp.py` (19 passed in auth+migration run) |
| `users.lang` dropped | ✅ | Migration copies to `ui_locale` then drops |
| Model aligned | ✅ | `user.py` — no `lang` column |
| API backward compat `lang` | ✅ | `user_presenter.py:7` |
| Prod auto-migrate | ❌ | `start-production.sh` — no alembic |
| Downgrade required? | Optional | `f1a2b3c4d5e6` has downgrade restoring `lang` |

### Risk: production DB behind head

If production Postgres has not run `e7f8` or `f1a2`, register/login will fail with SQL errors (missing `ui_locale` / `market_code` / FK to `markets`). **This is a plausible explanation for user-reported total auth failure.**

---

## 7. API Contract Audit

### Auth endpoints — CRA vs Next.js

| Endpoint | CRA | Next.js | Payload match | Response match |
|----------|-----|---------|---------------|----------------|
| `POST /api/auth/register` | ✅ | ✅ | ✅ `{username,password,lang}` | ✅ `{token}` 201 |
| `POST /api/auth/login` | ✅ | ✅ | ✅ | ✅ `{token}` 200 |
| `POST /api/auth/exchange` | ✅ | ✅ | ✅ | ✅ |
| `GET /api/auth/me` | ✅ | ✅ | Bearer | ✅ incl. `ui_locale`, `market_code` |
| `PATCH /api/auth/language` | ✅ | ✅ | ✅ | ✅ |
| `PATCH /api/auth/market` | N/A | ✅ | Next-only | Enhancement |
| `DELETE /api/auth/me` | ✅ | ✅ | ✅ | ✅ |
| `GET /api/public/dish-compare` | raw fetch | `createApiClient` (main) | ✅ | ✅ when API up |

### Client architecture

| Issue | Severity | Detail |
|-------|----------|--------|
| Single `fetch` client | OK | `lib/api/client.ts` replaces axios |
| BFF dual path | MEDIUM | `isBffEnabled()` splits behavior — rarely tested in CI |
| OpenAPI types | OK | `npm run generate:api` → `lib/api/generated/schema.ts` |
| No automated OpenAPI drift in CI | MEDIUM | Manual `export:openapi` + generate |
| E2E mocks generic `{}` | HIGH | `mock-api.ts:104` returns `{}` for unmocked paths — hides API errors |

### Hardcoded URLs

| Location | URL | Risk |
|----------|-----|------|
| `env.ts` dev fallback | `http://localhost:5001` | OK for dev |
| `googleAuthUrl` | `NEXT_PUBLIC_API_URL` | OK if env set |
| CI E2E | `http://localhost:5001` | Mocks — backend not required |

---

## 8. UI Regression Audit

| Item | CRA | Next.js | Issue |
|------|-----|---------|-------|
| DishCompare on login | Always when API up | **Invisible when API down** | `return null` |
| Login visual baselines | N/A | Self-baseline only | Did not compare to CRA pixels |
| EN demo videos | PL only in CRA | PL + EN files | EN = duplicate of PL (#82) |
| Global scrollbars / favicon | CRA | Ported #73 | PARITY_CONFIRMED per report |
| Tailwind in modules | Minimal CRA | Some utility classes remain | PARTIAL |

### Hydration / client boundaries

All interactive screens use `"use client"` where needed. No hydration errors observed in E2E build logs.

---

## 9. i18n / Market Separation Audit

| Concern | Status | Evidence |
|---------|--------|----------|
| Modular messages PL/EN | ✅ | `lib/i18n/messages/{pl,en}/*.ts` |
| Key parity test | ✅ | `i18n-key-parity.test.ts` |
| `ui_locale` ≠ `market_code` | ✅ | Phase 2 + Profile UI #74 |
| API `lang` compat field | ✅ | `user_presenter.py` |
| Product catalog by `market_code` | ✅ | Contract tests `test_ui_locale_market.py` |
| Login lang toggle (UI only) | ✅ | Does not change market until Profile |
| `users.lang` DB column | Removed #83 | Migration + model |

**PL/EN product data:** Correctly separated by market (`PL`/`GB`), not by UI locale alone — **IMPLEMENTED_DIFFERENTLY** from CRA (improvement).

---

## 10. Test Coverage Gaps

### Commands run

```bash
cd backend && uv run pytest -q                    # 149 passed, 7 skipped
cd frontend-next && npm run typecheck             # pass
cd frontend-next && npm run lint                  # 2 warnings (DrinksCard hooks)
cd frontend-next && npm run test                  # 33 passed
cd frontend-next && npm run build                 # pass
cd frontend-next && npm run test:e2e              # 47 passed (mocked)
```

### Why CI missed auth + widget regressions

| Gap | Explanation |
|-----|-------------|
| No real HTTP auth in E2E | `setupAuthenticatedMocks` fakes session |
| Login E2E | Only checks `#login-username` visible — not submit |
| Visual regression | Self-baseline; login baseline captured **without** DishCompare when no backend |
| Backend CI | Contract tests use in-memory/SQLite test DB — not production Postgres state |
| No post-deploy smoke | Railway deploy not validated by GitHub Actions |

---

## 11. Severity-ranked Findings

| ID | Severity | Title |
|----|----------|-------|
| AUTH-001 | **BLOCKER** | `NEXT_PUBLIC_API_URL` misconfiguration breaks all client API calls |
| AUTH-002 | **BLOCKER** | `FRONTEND_URL` CORS mismatch blocks auth from production origin |
| MIG-001 | **BLOCKER** | Production deploy does not run Alembic; schema drift breaks auth |
| TEST-001 | **CRITICAL** | Zero E2E coverage for real register/login flow |
| PARITY-001 | **HIGH** | DishCompare widget silently removed on API failure (`main`) |
| ENV-001 | **HIGH** | Audit could not run full stack locally — user issues not reproduced |
| AUTH-003 | **MEDIUM** | Middleware cookie + localStorage dual gate — edge-case risk |
| API-001 | **MEDIUM** | E2E mock handler returns `{}` for unknown endpoints |
| API-002 | **MEDIUM** | No CI OpenAPI drift check |
| UI-001 | **MEDIUM** | Visual regression compares Next to itself, not CRA |
| I18N-001 | **LOW** | EN demo WebM are PL copies |
| PARITY-002 | **LOW** | `LanguageSwitcher.tsx` dead code |
| DOC-001 | **LOW** | `CRA_NEXT_FINAL_PARITY_REPORT.md` claims COMPLETE prematurely |

---

## 12. Recommended Recovery Plan

**Rule:** 1 task = 1 branch. Order: blockers → API/DB → features → visual → CRA removal.

### Phase A — Auth & deploy blockers

| # | Branch | Scope | Acceptance criteria | Tests |
|---|--------|-------|---------------------|-------|
| A1 | `fix/auth-prod-env-checklist` | Document + script to verify `NEXT_PUBLIC_API_URL`, `FRONTEND_URL`, health | Curl register/login against staging returns 201/200 | Manual + `cutover_smoke.sh` |
| A2 | `fix/prod-alembic-on-deploy` | Railway release command or documented runbook step for `alembic upgrade head` | Staging DB at head `f1a2b3c4d5e6` before traffic | `test_migrations_stamp.py` on staging |
| A3 | `test/e2e-auth-real-api` | Playwright register+login against docker compose (real backend) | New job fails if auth broken | CI optional job |
| A4 | `fix/dish-compare-fallback` | Merge Route Handler + JSON fallback (currently uncommitted) | Login shows widget with backend stopped | Update login visual snapshots |

### Phase B — Verification

| # | Branch | Scope |
|---|--------|-------|
| B1 | `test/e2e-auth-negative` | Wrong password shows error; duplicate username 409 |
| B2 | `chore/openapi-drift-ci` | Fail CI if `openapi.json` stale vs backend |

### Phase C — Parity hardening

| # | Branch | Scope |
|---|--------|-------|
| C1 | `test/visual-cra-compare` | Optional CRA build vs Next screenshot job |
| C2 | `chore/remove-dead-language-switcher` | Delete unused `LanguageSwitcher.tsx` |

### Phase D — Epic closure (only after A+B green on staging)

| # | Branch | Scope |
|---|--------|-------|
| D1 | `docs/cra-next-regression-audit-closeout` | Update parity report with this audit |
| D2 | `chore/remove-cra-reference` | Remove `frontend/` — **only after sign-off** |

**Do not change:** backend business logic, Alembic history, or CRA tree until Phase A passes on staging.

---

## 13. Final Verdict

| Question | Answer |
|----------|--------|
| Registration works end-to-end | **NO** (not verified live; blocked by ENV-001; prod risk MIG-001/AUTH-001) |
| Login works end-to-end | **NO** (same) |
| Session survives refresh | **UNVERIFIED** (code path plausible; not live-tested) |
| Protected routes work | **YES** with mocks; **UNVERIFIED** with real API |
| CRA feature parity confirmed | **NO** |
| UI parity confirmed | **NO** (self-baselines only; DishCompare regression on `main`) |
| PL/EN behavior confirmed | **PARTIAL** (unit tests yes; live UNVERIFIED) |
| Database migrations safe | **YES** in code/tests; **NO** in production without manual upgrade |
| API contracts consistent | **YES** (contract tests); **UNVERIFIED** in deployed env |
| CI protects against these regressions | **NO** |
| CRA can be removed | **NO** |
| Migration epic can remain closed | **NO** |

---

## Appendix A — Routing audit

| CRA tab | Next route | Reachable | Notes |
|---------|------------|-----------|-------|
| login | `/login` | ✅ | Public |
| home | `/` | ✅ | No sidebar (by design) |
| macro | `/macro` | ✅ | |
| calendar | `/calendar` | ✅ | |
| schedule | `/schedule` | ✅ | |
| recipes | `/recipes` | ✅ | |
| products | `/products` | ✅ | |
| summary | `/summary` | ✅ | |
| export | `/export` | ✅ | |

No `not-found` customization found; dead scaffold removed (#77). `LanguageSwitcher` exists but is **NOT_REACHABLE**.

---

## Appendix B — PR / epic analysis

| Observation | Detail |
|-------------|--------|
| Epic closed in #79–#84 | Docs + TS + EN webm + drop `users.lang` — **no live auth validation** |
| Visual parity PRs #61–#73 | CSS port commits; acceptance = CI green + self-screenshots |
| Phase 6 E2E #75–#76 | Module smoke uses **mocks**, not production-like auth |
| Premature COMPLETE | `CRA_NEXT_FINAL_PARITY_REPORT.md` §12 before operational verification |

---

## Appendix C — Uncommitted working tree (not part of `main` audit baseline)

`git status` at audit time showed local WIP (not merged):

- `frontend-next/app/api/public/dish-compare/route.ts` (new)
- `frontend-next/lib/data/dishCompare/*` (new)
- `frontend-next/lib/api/public.ts`, `lib/config/env.ts` (modified)
- Login E2E snapshot PNGs (updated)

This audit evaluates **`main` @ `4aec515`** unless noted. The DishCompare fix addresses **PARITY-001** but is **not on `main`**.

---

## Appendix D — Recommended first recovery task

**Start with `fix/dish-compare-fallback` (A4)** — user-visible, low risk, unblocks landing parity.

**Immediately parallel:** verify production/staging:

```bash
curl -sf "$API_URL/health"
curl -sf -X POST "$API_URL/api/auth/register" -H 'Content-Type: application/json' \
  -d '{"username":"smoke'"$RANDOM"'","password":"secret123","lang":"pl"}'
```

And confirm Alembic: `SELECT version_num FROM alembic_version;` → `f1a2b3c4d5e6`.

---

*End of audit report.*
