# OnTrack

Meal planner and household budget tracker. Plan meals on a calendar, manage products and recipes, track expenses, and export shopping lists — with support for multiple household members and Polish/English UI.

## Features

- **Products & recipes** — build a personal catalog, import prices, look up macros
- **Meal calendar** — plan meals per day and per household member
- **Day schedule** — time blocks alongside meal planning
- **Budget summary** — fixed costs, drinks, and meal-related expenses with charts
- **Export** — shopping lists and printable views
- **Macro calculator** — nutrition targets and meal macros
- **Household members** — separate plans and budgets per person
- **Auth** — local accounts + Google OAuth (JWT)
- **i18n** — Polish and English UI (`LanguageContext.js`)
- **Monitoring** — Prometheus + Grafana (local dev stack)
- **Scraper pipeline** — offline shop/recipe data ingestion (`scraper/`)
- **Dish compare** — public widget comparing DIY vs restaurant cost (login page)

## Tech stack

| Layer | Stack |
|-------|--------|
| Backend | Python 3.11, FastAPI, SQLAlchemy, Alembic, JWT |
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind |
| Database | PostgreSQL 15 |
| Dev / deploy | Docker Compose locally, Railway + GitHub Actions in production |

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) with Compose (Docker Desktop or Engine)
- A `.env` file in the project root (see below)

## Quick start

```bash
git clone https://github.com/tomekmislun/Meal-planner-and-budgeter.git
cd Meal-planner-and-budgeter

cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD, FLASK_SECRET_KEY, JWT_SECRET_KEY at minimum

docker compose up --build
```

On first run, apply database migrations (once per fresh Postgres volume):

```bash
docker compose exec backend sh scripts/run-migrations.sh
```

If host ports `5432` / `6379` / `5001` are already in use, use the recovery override:

```bash
docker compose -p ontrack-recovery -f docker-compose.yml -f docker-compose.recovery.yml up -d db redis backend
docker compose -p ontrack-recovery exec backend sh scripts/run-migrations.sh
# Frontend locally: NEXT_PUBLIC_API_URL=http://localhost:5002 npm run dev -- -p 3003
```

First run builds images and installs frontend dependencies; it may take a few minutes.

### Local URLs

| Service | URL |
|---------|-----|
| **App (frontend)** | http://localhost:3000 |
| Backend API | http://localhost:5001 |
| Health check | http://localhost:5001/health |
| Grafana | http://localhost:3001 |
| Prometheus | http://localhost:9090 |

Run in the background:

```bash
docker compose up -d
```

Stop everything:

```bash
docker compose down
```

View logs:

```bash
docker compose logs -f
docker compose logs -f frontend backend
```

## Environment variables

Copy `.env.example` to `.env`. Never commit `.env`.

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_USER` | yes | Postgres user (local Docker) |
| `POSTGRES_PASSWORD` | yes | Postgres password |
| `POSTGRES_DB` | yes | Database name (`mealplanner`) |
| `FLASK_SECRET_KEY` | yes | Session/OAuth cookie secret (`token_hex(32)`) — env name kept for compat |
| `JWT_SECRET_KEY` | yes | JWT signing secret (different from above) |
| `FRONTEND_URL` | yes | Frontend origin(s), comma-separated for CORS (`http://localhost:3000,http://127.0.0.1:3000` locally) |
| `GOOGLE_REDIRECT_URI` | yes | OAuth callback (`http://localhost:5001/api/auth/google/callback` locally) |
| `GF_SECURITY_ADMIN_PASSWORD` | yes | Grafana admin password (local stack) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional | Google OAuth — login works without if using local auth |
| `GEMINI_API_KEY` | optional | AI features (graceful fallback if missing) |
| `PEXELS_API_KEY` | optional | Recipe image search |
| `DEEPSEEK_API_KEY` | optional | Macro lookup + scraper pipeline |
| `NEXT_PUBLIC_API_URL` | yes (frontend build) | Browser-facing API URL (`http://localhost:5001` locally) |

On Railway, the backend uses `DATABASE_URL=${{Postgres.DATABASE_URL}}` (private). Do not point the app at `DATABASE_PUBLIC_URL`.

## Tests

```bash
cd backend
uv sync --dev
uv run pytest tests/contract/ tests/test_health.py -q

cd frontend-next
npm ci && npm run test && npm run lint && npm run typecheck && npm run build
npm run test:e2e          # mocked API smoke tests
npm run test:e2e:auth     # real register/login (requires FastAPI + migrated Postgres)
```

`test:e2e:auth` expects FastAPI on `E2E_API_URL` (default `http://127.0.0.1:5001`) with `FRONTEND_URL` including `http://127.0.0.1:3002` (or `BACKEND_DEBUG=1`).

CI runs the FastAPI suite on every PR and push to `main` (`.github/workflows/ci.yml`).

## Project structure

```
OnTrack/
├── backend/             # FastAPI API + worker + Alembic + runtime data
│   ├── app/
│   ├── data/            # Runtime JSON (demo dataset — manifest.json)
│   ├── Dockerfile
│   └── railway.toml     # Railway config (Root Directory = backend)
├── app/                 # Legacy dish-compare build tooling (optional, not runtime)
├── frontend-next/       # Next.js frontend (Compose :3000, Railway ontrackapp)
├── scraper/             # Experimental offline pipeline (disconnected)
├── monitoring/          # Prometheus config (local dev)
├── docker-compose.yml
└── .github/DEPLOY.md
```

## API overview

All authenticated routes use `Authorization: Bearer <token>`.

| Prefix | Purpose |
|--------|---------|
| `/api/auth` | Login, register, Google OAuth |
| `/api/products` | Product catalog |
| `/api/recipes` | Recipes and ingredients |
| `/api/meal-plan` | Calendar meal entries |
| `/api/day-schedule` | Day time blocks |
| `/api/members` | Household members |
| `/api/nutrition` | Macro lookup |
| `/api/import` | Price import |
| `/api/fuel` | Fuel prices (expenses) |
| `/api/public` | Public endpoints (e.g. dish compare) |

## Scraper pipeline (optional)

Populates shop catalogs and ingredient DB into `scraper/data/`. **Not connected**
to the API runtime — see [`scraper/README.md`](scraper/README.md).

```bash
cd scraper
python3 -m venv .venv
.venv/bin/pip install openai rapidfuzz
python run_pipeline.py
```

See `scraper/data/README.md` for folder layout and pipeline steps.

## Translations

UI strings live in `frontend-next/lib/i18n/translations.ts` (Polish and English).

## Deployment

Production: merge to `main` → GitHub Actions (`test`) → Railway auto-deploy (Wait for CI enabled).

**Do not push directly to `main`.** Use feature branches and pull requests.

Full setup: [.github/DEPLOY.md](.github/DEPLOY.md)

## Developer workflow

```
feature branch → Pull Request → CI (FastAPI tests)
                               → review + merge
push to main     → CI green → Railway deploys backend + frontend
```

Local verification before a PR:

```bash
docker compose up --build
cd backend && uv run pytest tests/contract/ -q
cd frontend-next && npm run test && npm run build
```
