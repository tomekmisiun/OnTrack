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
| Backend | Python 3.11, Flask, SQLAlchemy, Alembic, JWT |
| Frontend | React (Create React App), axios |
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
docker compose logs -f frontend app
```

## Environment variables

Copy `.env.example` to `.env`. Never commit `.env`.

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_USER` | yes | Postgres user (local Docker) |
| `POSTGRES_PASSWORD` | yes | Postgres password |
| `POSTGRES_DB` | yes | Database name (`mealplanner`) |
| `FLASK_SECRET_KEY` | yes | Flask session secret (`token_hex(32)`) |
| `JWT_SECRET_KEY` | yes | JWT signing secret (different from above) |
| `FRONTEND_URL` | yes | Frontend origin (`http://localhost:3000` locally) |
| `GOOGLE_REDIRECT_URI` | yes | OAuth callback (`http://localhost:5001/api/auth/google/callback` locally) |
| `GF_SECURITY_ADMIN_PASSWORD` | yes | Grafana admin password (local stack) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional | Google OAuth — login works without if using local auth |
| `GEMINI_API_KEY` | optional | AI features (graceful fallback if missing) |
| `PEXELS_API_KEY` | optional | Recipe image search |
| `DEEPSEEK_API_KEY` | optional | Macro lookup + scraper pipeline |

On Railway, the backend uses `DATABASE_URL=${{Postgres.DATABASE_URL}}` (private). Do not point the app at `DATABASE_PUBLIC_URL`.

## Tests

Backend tests use in-memory SQLite — no Docker required:

```bash
pip install -r requirements.txt
pytest tests/ -v
```

CI runs the same suite on every PR and push to `main` (`.github/workflows/ci.yml`).

## Project structure

```
OnTrack/
├── app/
│   ├── routes/          # Flask blueprints (/api/*)
│   ├── models/          # SQLAlchemy models
│   ├── services/        # Business logic
│   ├── dish_compare/    # Public cost-comparison widget data
│   └── user_seeds/      # Seed data for new users
├── frontend/
│   └── src/
│       ├── components/  # UI tabs (Calendar, Recipes, Products, …)
│       ├── contexts/    # Auth, language, members, toasts
│       └── api.js       # Axios client + API helpers
├── migrations/          # Alembic (must stay in repo)
├── tests/               # pytest
├── scraper/             # Offline data pipeline (shops, recipes, macros)
├── monitoring/          # Prometheus config
├── docker-compose.yml
└── .github/DEPLOY.md    # Production deploy workflow
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

Populates shop catalogs, ingredient DB, and user seed data. Separate from the web app runtime.

```bash
cd scraper
python3 -m venv .venv
.venv/bin/pip install openai rapidfuzz
python run_pipeline.py
```

See `scraper/data/README.md` for folder layout and pipeline steps.

## Translations

UI strings live in `frontend/src/contexts/LanguageContext.js` (`T.pl` / `T.en`). See `frontend/TRANSLATIONS.md` for conventions and key map.

## Deployment

Production: merge to `main` → GitHub Actions (`test`) → Railway auto-deploy (Wait for CI enabled).

**Do not push directly to `main`.** Use feature branches and pull requests.

Full setup: [.github/DEPLOY.md](.github/DEPLOY.md)

## Developer workflow

```
feature branch → Pull Request → CI (pytest)
                               → review + merge
push to main     → CI green → Railway deploys backend + frontend
```

Local verification before a PR:

```bash
docker compose up    # full stack
pytest tests/ -v     # backend tests
```
