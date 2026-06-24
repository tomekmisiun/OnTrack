# Frontend Next.js migration plan

Migrate OnTrack UI from **React 19 + Create React App** (`frontend/`) to **Next.js App Router + TypeScript strict + Tailwind** (`frontend-next/`), without changing the FastAPI backend or replacing CRA until feature parity.

**Principles**

- `1 task = 1 branch = 1 PR`
- FastAPI owns all domain logic, auth, and PostgreSQL
- Next.js owns UI, routing, and typed API communication
- CRA remains runnable until task 15
- JWT stays in `localStorage` until optional task 16 (BFF / HttpOnly cookies)

**Source of truth for API:** FastAPI routes + OpenAPI (`/openapi.json`), contract tests — not stale `API_CONTRACT.md` alone.

---

## Task index

| # | Branch | Summary |
|---|--------|---------|
| 1 | `feat/frontend-next-foundation` | Next.js shell, TS strict, Tailwind, API client stub |
| 2 | `feat/frontend-next-typescript-types` | Shared types, strict lint rules |
| 3 | `feat/frontend-next-openapi-client` | OpenAPI → TypeScript types + typed client |
| 4 | `feat/frontend-next-providers` | Layout, Toast, Language shell |
| 5 | `feat/frontend-next-auth` | Auth context, JWT, Google OAuth |
| 6 | `feat/frontend-next-routing` | App Router replaces tab navigation |
| 7 | `feat/frontend-next-members` | Household members screens |
| 8 | `feat/frontend-next-products` | Product catalog + import |
| 9 | `feat/frontend-next-recipes` | Recipes module |
| 10 | `feat/frontend-next-meal-plan` | Calendar + meal plan |
| 11 | `feat/frontend-next-day-schedule` | Day schedule |
| 12 | `feat/frontend-next-remaining` | Summary, export, macro, welcome, dish compare |
| 13 | `feat/frontend-next-integration-tests` | Vitest/Playwright regression |
| 14 | `feat/frontend-next-docker` | Compose + dev/prod Docker for `frontend-next` |
| 15 | `chore/frontend-remove-cra` | Cutover, remove `frontend/`, update Railway |
| 16 | `feat/frontend-next-bff-cookies` | Optional BFF + HttpOnly cookies |

---

## Task 1 — Next.js foundation

| Field | Value |
|-------|-------|
| **Branch** | `feat/frontend-next-foundation` |
| **Goal** | Runnable `frontend-next/` with App Router, TS strict, Tailwind, env-based API URL, minimal HTTP client |
| **Files** | `frontend-next/**`, `docs/FRONTEND_NEXT_MIGRATION_PLAN.md` |
| **Dependencies** | None |
| **Acceptance** | `npm run lint`, `typecheck`, `build` pass; CRA `npm run build` still passes; no backend changes |
| **Tests** | Manual `GET /health` via `HealthStatus`; optional unit test for `ApiError` |
| **Risks** | Port 3000 conflict with CRA — document alternate port |
| **Out of scope** | Auth, screens, Docker, OpenAPI codegen, CRA removal |
| **Status** | Done (PR #41) |

---

## Task 2 — TypeScript conventions and shared types

| Field | Value |
|-------|-------|
| **Branch** | `feat/frontend-next-typescript-types` |
| **Goal** | Enforce `noUncheckedIndexedAccess`, path aliases, shared `types/` for UI-only models |
| **Files** | `frontend-next/tsconfig.json`, `frontend-next/types/**`, ESLint strict rules |
| **Dependencies** | Task 1 |
| **Acceptance** | `tsc --noEmit` clean; documented conventions in `frontend-next/README.md` |
| **Tests** | Typecheck in CI (new job) |
| **Risks** | Over-typing before OpenAPI codegen — keep UI types minimal |
| **Out of scope** | Duplicating Pydantic schemas by hand |
| **Status** | Done |

---

## Task 3 — OpenAPI TypeScript client

| Field | Value |
|-------|-------|
| **Branch** | `feat/frontend-next-openapi-client` |
| **Goal** | Generate types from FastAPI OpenAPI; wire typed client |
| **Files** | `frontend-next/scripts/generate-api-types.ts`, `frontend-next/lib/api/generated/**`, `package.json` scripts |
| **Dependencies** | Task 1–2 |
| **Tool choice** | **`openapi-typescript`** + thin fetch wrapper (recommended): small surface, no runtime codegen lock-in. **Orval** alternative if client + hooks generation is preferred later. |
| **Acceptance** | `npm run generate:api` produces types; health + one authenticated endpoint typed |
| **Tests** | Script runs in CI against exported OpenAPI artifact or live `/openapi.json` in integration job |
| **Risks** | OpenAPI drift — pin generation to CI + backend contract tests |
| **Out of scope** | Migrating all `api.js` modules at once |
| **Status** | Done |

**Workflow**

```text
npm run export:openapi → openapi/openapi.json
→ npm run generate:api → lib/api/generated/schema.ts
→ openapi-helpers + createApiClient
```

---

## Task 4 — Global layout and providers

| Field | Value |
|-------|-------|
| **Branch** | `feat/frontend-next-providers` |
| **Goal** | Root layout matching CRA provider tree (shell only): Toast, Language |
| **Files** | `frontend-next/app/layout.tsx`, `frontend-next/contexts/ToastContext.tsx`, `LanguageContext.tsx`, `components/` chrome |
| **Dependencies** | Task 1–3 |
| **Acceptance** | Toast + language switch work on foundation page; i18n keys ported incrementally |
| **Tests** | Component tests for Toast |
| **Risks** | Large `LanguageContext.js` — split or import JSON in later pass |
| **Out of scope** | Auth, Member context |
| **Status** | Done |

---

## Task 5 — Authentication and Google OAuth

| Field | Value |
|-------|-------|
| **Branch** | `feat/frontend-next-auth` |
| **Goal** | Port `AuthContext` behavior: login, register, exchange, me, logout, delete account |
| **Files** | `frontend-next/contexts/AuthContext.tsx`, `lib/api/auth.ts`, `app/login/page.tsx` |
| **Dependencies** | Task 3–4 |
| **Acceptance** | Password login + Google redirect + `?code=` exchange; JWT in `localStorage`; 401 clears session |
| **Tests** | MSW mocks; manual OAuth with credentials |
| **Risks** | SSR + `localStorage` — auth client components only |
| **Out of scope** | HttpOnly cookies, BFF |
| **Status** | Done |

---

## Task 6 — App Router (replace tab navigation)

| Field | Value |
|-------|-------|
| **Branch** | `feat/frontend-next-routing` |
| **Goal** | URL routes for home, macro, calendar, schedule, recipes, products, summary, export |
| **Files** | `frontend-next/app/(app)/**/page.tsx`, `components/Sidebar.tsx`, middleware for auth gate |
| **Dependencies** | Task 5 |
| **Acceptance** | Deep links work; protected routes redirect to login; parity with CRA tabs |
| **Tests** | E2E navigation smoke |
| **Risks** | Large Calendar state — may need client-only pages |
| **Out of scope** | Full screen migration |
| **Status** | Done |

---

## Task 7 — Members module

| Field | Value |
|-------|-------|
| **Branch** | `feat/frontend-next-members` |
| **Goal** | `MemberContext`, toggles, CRUD via `/api/members` |
| **Files** | `contexts/MemberContext.tsx`, `components/MemberToggles.tsx`, `lib/api/members.ts` |
| **Dependencies** | Task 5–6 |
| **Acceptance** | Contract parity with `test_members_contract.py` behaviors |
| **Tests** | Integration tests with MSW |
| **Out of scope** | Macro profile (partial — link to task 12) |
| **Status** | Done |

---

## Task 8 — Products and catalog

| Field | Value |
|-------|-------|
| **Branch** | `feat/frontend-next-products` |
| **Goal** | Paginated list, search, customize, import flows |
| **Files** | `app/(app)/products/**`, port from `Products.js`, `lib/api/products.ts`, `lib/productPage.ts` |
| **Dependencies** | Task 3, 6–7 |
| **Acceptance** | Paginated `{items,total}`; system vs private UX; import AI/free |
| **Tests** | Port `productPage.test.ts`; MSW contract tests |
| **Risks** | Import dropdown needs search API — align with backend pagination |
| **Out of scope** | Backend catalog changes |

---

## Task 9 — Recipes module

| Field | Value |
|-------|-------|
| **Branch** | `feat/frontend-next-recipes` |
| **Goal** | Recipe CRUD, favorites, paste-parse, product matching |
| **Files** | `Recipes.js` → `app/(app)/recipes/**`, `lib/api/recipes.ts` |
| **Dependencies** | Task 8 (product list for ingredients) |
| **Acceptance** | Parity with `test_recipes_contract.py` |
| **Tests** | Component + MSW |
| **Out of scope** | Server-side AI recipe parse (not in backend today) |

---

## Task 10 — Meal plan and calendar

| Field | Value |
|-------|-------|
| **Branch** | `feat/frontend-next-meal-plan` |
| **Goal** | Calendar grid, DnD, copy/paste, meal-plan API |
| **Files** | `Calendar.js` → multiple components, `@dnd-kit/core`, `lib/api/mealPlan.ts` |
| **Dependencies** | Task 7, 9 |
| **Acceptance** | Parity with `test_meal_plan_contract.py` |
| **Tests** | E2E critical paths |
| **Risks** | Largest UI module — split into sub-PRs if needed |
| **Out of scope** | `@fullcalendar` (unused in CRA) |

---

## Task 11 — Day schedule

| Field | Value |
|-------|-------|
| **Branch** | `feat/frontend-next-day-schedule` |
| **Goal** | Weekly schedule grid + bulk work blocks |
| **Files** | `DaySchedule.js` port, `lib/api/daySchedule.ts` |
| **Dependencies** | Task 7, 6 |
| **Acceptance** | Parity with `test_day_schedule_contract.py` |

---

## Task 12 — Remaining modules

| Field | Value |
|-------|-------|
| **Branch** | `feat/frontend-next-remaining` |
| **Goal** | Welcome, MacroCalculator, Summary, Export, Profile, Privacy, DishCompare, Joyride tour |
| **Files** | Remaining CRA components, `lib/api/nutrition.ts`, `fuel.ts`, `public/dish-compare` |
| **Dependencies** | Tasks 7–11 |
| **Acceptance** | Feature matrix from audit marked migrated |
| **Tests** | Full frontend test suite |

---

## Task 13 — Integration and regression tests

| Field | Value |
|-------|-------|
| **Branch** | `feat/frontend-next-integration-tests` |
| **Goal** | Vitest + Playwright (or Cypress); CI job |
| **Files** | `.github/workflows/ci.yml`, `frontend-next/tests/**` |
| **Dependencies** | Task 12 |
| **Acceptance** | CI runs lint, typecheck, unit, optional E2E against docker compose |
| **Out of scope** | Replacing backend contract tests |

---

## Task 14 — Docker and local development

| Field | Value |
|-------|-------|
| **Branch** | `feat/frontend-next-docker` |
| **Goal** | `frontend-next/Dockerfile`, compose service on port **3002** (CRA keeps 3000) |
| **Files** | `docker-compose.yml`, `frontend-next/Dockerfile`, `.env.example` root |
| **Dependencies** | Task 1 |
| **Acceptance** | `docker compose up frontend-next` works; CRA service untouched |
| **Risks** | `NEXT_PUBLIC_*` baked at build time — document Railway build args |
| **Out of scope** | Replacing nginx CRA image in production |

---

## Task 15 — Remove CRA

| Field | Value |
|-------|-------|
| **Branch** | `chore/frontend-remove-cra` |
| **Goal** | Railway/deploy points to `frontend-next`; delete `frontend/` |
| **Files** | `frontend/railway.toml` → `frontend-next`, root README, `.github/DEPLOY.md` |
| **Dependencies** | Tasks 1–13, stakeholder sign-off |
| **Acceptance** | No references to `react-scripts`; production on Next.js |
| **Risks** | Rollback plan documented |

---

## Task 16 — Optional BFF and HttpOnly cookies (future)

| Field | Value |
|-------|-------|
| **Branch** | `feat/frontend-next-bff-cookies` |
| **Goal** | Next.js Route Handlers as thin proxy; HttpOnly session cookies; reduce XSS token exposure |
| **Dependencies** | Task 15, backend cookie-session design (may need FastAPI changes — **separate backend epic**) |
| **Acceptance** | Documented threat model; no duplicate domain logic in Route Handlers |
| **Out of scope** | This epic does not modify FastAPI auth in tasks 1–15 |

---

## Environment mapping

| CRA | Next.js |
|-----|---------|
| `REACT_APP_API_URL` | `NEXT_PUBLIC_API_URL` |
| `localStorage.token` | Unchanged until task 16 |
| Port 3000 (compose) | 3000 dev (or 3002 in compose task 14) |

---

## OpenAPI tooling decision (task 3)

| Option | Pros | Cons |
|--------|------|------|
| **openapi-typescript** (recommended) | Lightweight types only; fits existing `fetch` client | Manual client methods per path |
| **Orval** | Generates client + React Query hooks | Heavier; opinionated; more deps |
| **openapi-fetch** | Typed fetch with openapi-typescript | Extra abstraction |

**Recommendation:** `openapi-typescript` + existing `createApiClient()` wrapper — minimal diff from foundation, no `any`, aligns with “no business logic in Next.js”.

---

## Validation commands (per task)

```bash
# frontend-next
cd frontend-next && npm ci && npm run lint && npm run typecheck && npm run build

# legacy CRA (until task 15)
cd frontend && npm ci && npm run build && CI=true npm test -- --watchAll=false

# backend (unchanged)
cd backend && uv run pytest -q
```

---

## References

- Audit: `docs/PROJECT_TECHNICAL_AUDIT.md`
- CRA API client: `frontend/src/api.js`
- FastAPI entry: `backend/app/main.py`
- OpenAPI: `http://localhost:5001/openapi.json` when API running
