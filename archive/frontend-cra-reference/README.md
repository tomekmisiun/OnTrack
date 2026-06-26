# OnTrack CRA frontend — **archived reference**

> **This is NOT the production frontend.**  
> Production UI: [`frontend-next/`](../../frontend-next/) (Next.js App Router).  
> Railway / Docker Compose deploy **`frontend-next`** only.

This tree was moved from repo-root `frontend/` to **`archive/frontend-cra-reference/`** on 2026-05-26 (task #10). It remains a read-only CRA snapshot from commit **`dca8eb9`** for historical comparison.

- [`docs/CRA_REFERENCE.md`](../../docs/CRA_REFERENCE.md) — comparison guide (paths updated for archive location)
- [`docs/CRA_NEXT_VISUAL_AND_I18N_AUDIT.md`](../../docs/CRA_NEXT_VISUAL_AND_I18N_AUDIT.md) — parity audit

## Do not

- Point Railway Root Directory here
- Change `docker-compose.yml` to build this app for production
- Commit `node_modules/` or `build/` artifacts from local runs

## Local run (comparison only)

Requires FastAPI on `http://localhost:5001`.

```bash
cd archive/frontend-cra-reference
npm ci
REACT_APP_API_URL=http://localhost:5001 npm start
# → http://localhost:3000 (stop frontend-next first if port conflict)
```

Compare with Next.js on port **3002** (`frontend-next/`).

## Source snapshot

| Field | Value |
|-------|-------|
| Restored from | `dca8eb9` |
| Archived on | 2026-05-26 (`chore/archive-legacy-frontend`) |
| Stack | React 19 + Create React App |
