# OnTrack CRA frontend — **reference only**

> **This is NOT the production frontend.**  
> Production UI: [`frontend-next/`](../frontend-next/) (Next.js App Router).  
> Railway / Docker Compose deploy **`frontend-next`** only.

This directory was restored from commit **`dca8eb9`** for **visual and behavioral comparison** during the CRA → Next.js parity epic. See:

- [`docs/CRA_REFERENCE.md`](../docs/CRA_REFERENCE.md) — how to run side-by-side
- [`docs/CRA_NEXT_VISUAL_AND_I18N_AUDIT.md`](../docs/CRA_NEXT_VISUAL_AND_I18N_AUDIT.md) — parity audit & roadmap

## Do not

- Point Railway Root Directory to `frontend/`
- Change `docker-compose.yml` to build this app for production
- Delete this tree until parity epic is complete (**see Decision below**)

## Decision (2026-05-26)

**Status: KEEP as reference.** Approved in full-project audit follow-up (`docs/audits/FULL_PROJECT_AUDIT.md` §21).

- Remains in the repository for CRA ↔ Next.js visual and behavioral comparison.
- **Not** part of production runtime (Compose / Railway / CI use `frontend-next/` only).
- Planned removal/archival in task **`chore/archive-legacy-frontend`** after `feat/visual-parity-login` (or earlier only with explicit user approval).
- Do not commit `node_modules/` or `build/` artifacts from local runs.

## Local run (comparison only)

Requires FastAPI on `http://localhost:5001`.

```bash
cd frontend
npm ci
REACT_APP_API_URL=http://localhost:5001 npm start
# → http://localhost:3000 (stop frontend-next first if port conflict)
```

In another terminal, run Next.js on port **3002**:

```bash
cd frontend-next
npm run dev -- -p 3002
# → http://localhost:3002
```

Compare screens at the same viewport (1440×900 recommended).

## Source snapshot

| Field | Value |
|-------|-------|
| Restored from | `dca8eb9` |
| Restored on branch | `chore/restore-cra-reference` |
| Stack | React 19 + Create React App |
