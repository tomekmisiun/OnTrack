# OnTrack — Next.js frontend (migration)

New frontend shell migrating from Create React App (`frontend/`). This package runs **alongside** the legacy CRA app until feature parity is reached.

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

## Scripts

```bash
npm ci
npm run dev          # http://localhost:3000 (use port 3001 if CRA occupies 3000)
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

- JWT in `localStorage` (`lib/auth/storage.ts`) — unchanged from CRA until optional BFF task
- `contexts/AuthContext.tsx` — bootstrap, `?code=` OAuth exchange, login/register/logout
- `/login` — password + Google OAuth redirect to FastAPI `/api/auth/google`

CI runs `generate:api` before lint to catch drift.

## Migration plan

See [`docs/FRONTEND_NEXT_MIGRATION_PLAN.md`](../docs/FRONTEND_NEXT_MIGRATION_PLAN.md).
