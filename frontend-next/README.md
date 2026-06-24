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
contexts/      — React contexts (auth, language, etc. — future tasks)
lib/api/       — HTTP client and API modules
lib/config/    — Environment helpers
styles/        — Global CSS + Tailwind entry
public/        — Static assets
```

## API client

- Base URL from `NEXT_PUBLIC_API_URL` via `lib/config/env.ts`
- `lib/api/client.ts` — `createApiClient()` with optional Bearer token hook (unused in foundation)
- `lib/api/health.ts` — `GET /health` smoke test

OpenAPI-generated types are planned in a later task (`openapi-typescript`).

## Migration plan

See [`docs/FRONTEND_NEXT_MIGRATION_PLAN.md`](../docs/FRONTEND_NEXT_MIGRATION_PLAN.md).
