# OnTrack — Next.js frontend

Production UI for OnTrack: meal planning, products, recipes, budget summary, and export — built with Next.js App Router, TypeScript strict, and Tailwind CSS.

## Stack

- Next.js 15 (App Router)
- React 19
- TypeScript (`strict: true`)
- Tailwind CSS 4
- Central FastAPI HTTP client (`lib/api/`)

## Prerequisites

- Node.js 20+ (matches production Docker image)
- Running FastAPI backend (default `http://localhost:5001`)

## Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | FastAPI base URL (no trailing slash required) |
| `NEXT_PUBLIC_BFF_ENABLED` | Set to `1` for HttpOnly cookie BFF mode (default off) |

See `docs/FRONTEND_NEXT_BFF.md` for BFF threat model and rollout.

## Scripts

```bash
npm ci
npm run dev          # http://localhost:3000
npm run lint
npm run typecheck
npm run build
npm run start
```

## Structure

```text
app/           — App Router pages and layouts
components/    — UI components
contexts/      — React contexts (Language, Toast; auth/member in later tasks)
lib/i18n/      — Translation tables (ported from CRA)
lib/api/       — HTTP client and API modules
lib/config/    — Environment helpers
styles/        — Global CSS + Tailwind entry
types/         — UI-only TypeScript types (not API DTOs — those come from OpenAPI)
public/        — Static assets
```

## TypeScript conventions

- **`strict: true`** plus **`noUncheckedIndexedAccess`** — array and record indexing may be `undefined`; narrow before use.
- **Path alias** `@/*` maps to the package root (`baseUrl: "."` in `tsconfig.json`).
- **Import style** — use `import type { … }` for type-only imports (enforced by ESLint).
- **`types/`** — UI state shapes (`AsyncState`, `FetchState`), view models, and helpers. Do **not** hand-write Pydantic/API DTOs here; task 3 generates those from OpenAPI.
- **`lib/api/`** — transport layer and thin endpoint wrappers until the typed OpenAPI client lands.
- **No `any`** — ESLint error; prefer `unknown` and narrowing.
- **Unused bindings** — prefix with `_` if intentionally unused.

## API client

- Base URL from `NEXT_PUBLIC_API_URL` via `lib/config/env.ts`
- `lib/api/client.ts` — `createApiClient()` with optional Bearer token hook (unused in foundation)
- `lib/api/health.ts` — `GET /health` smoke test

OpenAPI-generated types are planned in a later task (`openapi-typescript`).

## OpenAPI types

```bash
# Refresh snapshot from FastAPI (requires uv + backend deps)
npm run export:openapi

# Regenerate TypeScript from openapi/openapi.json
npm run generate:api
```

- Committed snapshot: `openapi/openapi.json`
- Generated types: `lib/api/generated/schema.ts` (do not edit by hand)
- Helpers: `lib/api/openapi-helpers.ts` (`OperationResponse`, `ApiSchema`)
- Example modules: `lib/api/health.ts`, `lib/api/auth.ts`

## Authentication

**Default:** JWT in `localStorage` (`lib/auth/storage.ts`) — CRA parity.

**Optional BFF** (`NEXT_PUBLIC_BFF_ENABLED=1`): HttpOnly `ontrack_session` cookie; Route Handlers at `/api/bff/*` and `/api/auth/session`. See `docs/FRONTEND_NEXT_BFF.md`.

- `contexts/AuthContext.tsx` — bootstrap, `?code=` OAuth exchange, login/register/logout
- `/login` — password + Google OAuth redirect to FastAPI `/api/auth/google`

## Routing

- Protected app routes under `app/(app)/` — `/`, `/macro`, `/calendar`, `/schedule`, `/recipes`, `/products`, `/summary`, `/export`
- `middleware.ts` — session gate (`ontrack_has_token` or HttpOnly `ontrack_session`)
- `components/layout/Sidebar.tsx` — CRA tab parity (sidebar hidden on home)
- Module screens: products (task 8), recipes (task 9), calendar/meal plan (task 10), day schedule (task 11); summary, export, etc. are placeholders until task 12

## Members

- `contexts/MemberContext.tsx` — list, active member, included toggles (CRA parity)
- `components/MemberToggles.tsx` — add, rename, delete, include toggles
- `lib/api/members.ts` — CRUD via `/api/members`
- `npm run test:members` — unit check for target member ID helpers

## Products

- `components/products/ProductsScreen.tsx` — paginated catalog, add/paste, import, edit
- `hooks/useProductsPage.ts` — state and handlers (CRA `Products.js` parity)
- `lib/api/products.ts`, `lib/api/import.ts`, `lib/api/nutrition.ts`
- `npm run test:products` — unit check for pagination helpers

## Recipes

- `components/recipes/RecipesScreen.tsx` — paste-parse, CRUD, favorites, categories, product matching
- `hooks/useRecipesPage.ts` — state and handlers (CRA `Recipes.js` parity)
- `lib/api/recipes.ts`, `lib/recipes/**` — parser, search, ingredient canonicalization
- `npm run test:recipes` — unit check for fuzzySearch and parseRecipeText

## Calendar / meal plan

- `components/calendar/CalendarScreen.tsx` — month grid, recipe carousel, DnD, templates, copy/paste
- `hooks/useCalendarPage.ts` — state and handlers (CRA `Calendar.js` parity)
- `lib/api/mealPlan.ts`, `lib/dates.ts`, `lib/mealPlan/state.ts`, `types/mealPlan.ts`
- `npm run test:calendar` — unit check for date grid helpers

## Day schedule

- `components/schedule/DayScheduleScreen.tsx` — weekly 24h grid, drag blocks, bulk work hours
- `hooks/useDaySchedulePage.ts` — state and handlers (CRA `DaySchedule.js` parity)
- `lib/api/daySchedule.ts`, `lib/schedule/**` — API, parse helpers, overlap detection
- `npm run test:schedule` — unit check for `parseScheduleBlockText`

## Remaining modules (task 12)

- `components/welcome/WelcomeScreen.tsx` — home tiles with insights (`useWelcomeStats`)
- `components/macro/MacroScreen.tsx` — BMI/TDEE/macro calculator with profile save
- `components/summary/**` — expenses, drinks card, pie chart, product table
- `components/export/ExportScreen.tsx` — print/HTML export (macro card, calendar, shopping list)
- `components/profile/ProfileModal.tsx` — account, language, delete, restart tour
- `components/privacy/PrivacyPolicyModal.tsx` — login page privacy link
- `components/dish-compare/DishCompare.tsx` — public marketing widget on login
- `components/tour/TourProvider.tsx` — react-joyride onboarding
- `lib/api/fuel.ts`, `lib/api/public.ts`, `saveMemberProfile` in `lib/api/members.ts`
- `npm run test:expense` — sanity check for expense item math

CI runs `generate:api`, `npm test` (Vitest unit tests), lint, typecheck, and build. A separate CI job runs Playwright smoke tests against a production build.

## Tests

```bash
npm run test              # all Vitest unit tests (imports real TS modules)
npm run test:watch        # Vitest watch mode
npm run test:e2e          # Playwright smoke tests (builds + starts on port 3002)
npm run test:recipes      # single suite shortcut
```

Unit tests live in `tests/unit/` and replace the legacy `scripts/check-*.mjs` guards. E2E tests in `tests/e2e/` cover login/auth middleware (`smoke.spec.ts`) and logged-in module loads with mocked API (`modules-smoke.spec.ts`).

## Docker

Local Compose runs the Next.js dev server on **port 3000**:

```bash
# From repo root — requires .env and running backend stack
docker compose up --build frontend
# http://localhost:3000
```

Production image (standalone output):

```bash
docker build -t ontrack-frontend-next \
  -f Dockerfile.railway \
  --build-arg NEXT_PUBLIC_API_URL=https://your-api.example.com \
  .
docker run --rm -p 3002:3000 ontrack-frontend-next
```

`NEXT_PUBLIC_API_URL` is **baked at build time** — set it via `--build-arg` or Railway build variables before `npm run build`.

## Migration plan

See [`docs/FRONTEND_NEXT_MIGRATION_PLAN.md`](../docs/FRONTEND_NEXT_MIGRATION_PLAN.md).
