# CRA reference frontend — comparison guide

## Which app is production?

| Directory | Role | Deployed |
|-----------|------|----------|
| **`frontend-next/`** | Production Next.js UI | ✅ Railway `ontrackapp`, Docker Compose `frontend` service |
| **`archive/frontend-cra-reference/`** | CRA reference snapshot (`dca8eb9`) | ❌ **Never deploy** |

## Why CRA was restored

Task 15 removed `frontend/src/` from `main`. The parity epic needed CRA as the **source of truth** for layout, CSS, marketing login, and component behavior. Reference code now lives in `archive/frontend-cra-reference/`; production remains `frontend-next/`.

## Side-by-side local comparison

### Prerequisites

- FastAPI backend: `docker compose up backend` or `cd backend && uv run uvicorn app.main:app --port 5001`
- Node 20+

### Terminal 1 — CRA reference (port 3000)

```bash
cd archive/frontend-cra-reference
npm ci
REACT_APP_API_URL=http://localhost:5001 npm start
```

Open: http://localhost:3000

### Terminal 2 — Next.js production UI (port 3002)

```bash
cd frontend-next
npm ci
NEXT_PUBLIC_API_URL=http://localhost:5001 npm run dev -- -p 3002
```

Open: http://localhost:3002

### Viewports to compare

| Viewport | Use |
|----------|-----|
| 1440 × 900 | Desktop primary |
| 1280 × 800 | Laptop |
| 768 × 1024 | Tablet |
| 375 × 812 | Mobile |

### Screens checklist

1. Login (unauthenticated) — marketing layout, showcase, demos
2. Welcome `/` — tiles, insights, members
3. `/macro`, `/calendar`, `/schedule`, `/recipes`, `/products`, `/summary`, `/export`
4. Profile modal, Privacy modal
5. PL and EN language switch

## Reading CRA without checkout

```bash
git show dca8eb9:frontend/src/components/Login.js
git show dca8eb9:frontend/src/components/Login.css
```

## Updating the reference snapshot

Only refresh CRA reference when intentionally re-baselining parity (rare):

```bash
git checkout <new-cra-commit> -- frontend/src frontend/public
# Update frontend/README.md snapshot commit hash
```

Do **not** merge CRA changes into `frontend-next/` wholesale — see archived migration audit [`docs/audits/archive/cra-next-migration/CRA_NEXT_VISUAL_AND_I18N_AUDIT.md`](audits/archive/cra-next-migration/CRA_NEXT_VISUAL_AND_I18N_AUDIT.md) for historical context.
