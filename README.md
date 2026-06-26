<a id="readme-top"></a>

<div align="center">

# 🥗 OnTrack

### Meal planning, nutrition and household budget management in one workspace

Plan meals on a calendar, manage products and recipes, calculate nutrition targets, organize household schedules and track everyday food-related expenses.

<br />

[![Repository](https://img.shields.io/badge/REPOSITORY-OPEN_ON_GITHUB-181717?style=for-the-badge&logo=github)](https://github.com/tomekmisiun/OnTrack)
[![Technical Audit](https://img.shields.io/badge/TECHNICAL_AUDIT-READ_REPORT-1f6feb?style=for-the-badge&logo=readthedocs&logoColor=white)](docs/audits/PROJECT_CURRENT_STATE_AUDIT_2026-06-26.md)
[![Migration Report](https://img.shields.io/badge/NEXT.JS_MIGRATION-ARCHIVED_REPORT-666666?style=for-the-badge&logo=nextdotjs)](docs/audits/archive/cra-next-migration/CRA_NEXT_FINAL_PARITY_REPORT.md)

<br />

[![CI](https://github.com/tomekmisiun/OnTrack/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/tomekmisiun/OnTrack/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/tomekmisiun/OnTrack?style=flat-square)](LICENSE)
[![Last commit](https://img.shields.io/github/last-commit/tomekmisiun/OnTrack?style=flat-square)](https://github.com/tomekmisiun/OnTrack/commits/main)
[![Repository size](https://img.shields.io/github/repo-size/tomekmisiun/OnTrack?style=flat-square)](https://github.com/tomekmisiun/OnTrack)
[![Open issues](https://img.shields.io/github/issues/tomekmisiun/OnTrack?style=flat-square)](https://github.com/tomekmisiun/OnTrack/issues)

<br />

![Python](https://img.shields.io/badge/Python-3.14-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-API-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)

![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-Queue_&_Cache-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-CI%2FCD-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)
![Railway](https://img.shields.io/badge/Railway-Deployment-0B0D0E?style=for-the-badge&logo=railway&logoColor=white)

</div>

---

## Table of contents

- [About](#about)
- [The problem](#the-problem)
- [Core capabilities](#core-capabilities)
- [Product modules](#product-modules)
- [How it works](#how-it-works)
- [Architecture](#architecture)
- [Key engineering decisions](#key-engineering-decisions)
- [Technology stack](#technology-stack)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Testing and quality](#testing-and-quality)
- [API overview](#api-overview)
- [Localization and markets](#localization-and-markets)
- [Deployment](#deployment)
- [Project status](#project-status)
- [Repository structure](#repository-structure)
- [Documentation](#documentation)
- [Development workflow](#development-workflow)
- [License](#license)
- [Author](#author)

---

## About

**OnTrack** is a full-stack meal-planning and household budget application.

It provides one place to:

- build a personal product and recipe catalog,
- plan meals for individual household members,
- organize a weekly day schedule,
- calculate calorie and macro targets,
- track meal-related expenses,
- generate shopping lists and printable exports.

The application uses a **FastAPI** backend, a **Next.js App Router** frontend and **PostgreSQL** as its primary data store.

### At a glance

| Area | State |
|---|---|
| Meal planning and calendar | ✅ Implemented |
| Products and recipes | ✅ Implemented |
| Household members | ✅ Implemented |
| Nutrition calculator | ✅ Implemented |
| Budget summary and export | ✅ Implemented |
| Local and Google authentication | ✅ Implemented |
| Polish and English interface | ✅ Implemented |
| Polish and British product markets | ✅ Implemented |
| Automated CI test matrix | ✅ Implemented |
| Production hardening | 🟡 Ongoing |

---

## The problem

Meal planning is usually split across several disconnected tools:

- recipes are stored in notes or bookmarks,
- prices and nutrition values live in spreadsheets,
- meals are planned in a calendar,
- shopping lists are prepared manually,
- household members follow different diets and schedules,
- actual food-related expenses are difficult to compare with the plan.

OnTrack connects these workflows through one data model. Products feed recipes, recipes feed the meal calendar, and the calendar feeds summaries, nutrition calculations and exports.

---

## Core capabilities

<table>
<tr>
<td width="50%" valign="top">

### 🥕 Products and recipes

- shared system product catalog
- personal products and overrides
- product price and macro data
- recipe CRUD
- recipe favorites
- ingredient matching
- recipe categories
- text-based recipe parsing
- receipt and price import
- recipe image lookup

</td>
<td width="50%" valign="top">

### 📅 Meal planning

- monthly meal calendar
- drag-and-drop meal placement
- planning per household member
- recipe carousel
- copy and paste operations
- reusable week templates
- meal ordering within a day
- system and personal recipes
- date-range loading
- persistent database storage

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 👨‍👩‍👧 Household management

- multiple household members
- separate plans per person
- active-member selection
- included-member filters
- individual profile targets
- rename and delete operations
- member-scoped schedules
- member-scoped nutrition settings

</td>
<td width="50%" valign="top">

### ⏱️ Day scheduling

- weekly 24-hour schedule
- draggable time blocks
- recurring work-hour setup
- bulk schedule operations
- overlap detection
- per-member schedules
- visual weekly grid
- text schedule parsing

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 📊 Budget and nutrition

- BMI and TDEE calculator
- calorie and macro targets
- member profile persistence
- planned meal cost summary
- fixed-expense tracking
- drinks and additional costs
- fuel-price data
- expense charts
- product-level cost breakdowns

</td>
<td width="50%" valign="top">

### 📄 Export and public tools

- shopping-list generation
- calendar export
- macro summary export
- printable HTML views
- multiple export documents
- public dish-cost comparison
- DIY versus restaurant comparison
- localized public data
- offline scraper pipeline

</td>
</tr>
</table>

---

## Product modules

| Route | Module | Purpose |
|---|---|---|
| `/login` | Authentication | Local login, registration, Google OAuth and public product showcase |
| `/` | Dashboard | Overview, shortcuts and household insights |
| `/macro` | Macro calculator | BMI, TDEE, calorie and macronutrient targets |
| `/calendar` | Meal calendar | Plan recipes by day and household member |
| `/schedule` | Day schedule | Manage weekly time blocks |
| `/recipes` | Recipes | Create, search, edit and favorite recipes |
| `/products` | Products | Manage the product catalog, macros and imported prices |
| `/summary` | Summary | Analyze meal costs and additional expenses |
| `/export` | Export | Generate shopping lists and printable planning documents |

---

## How it works

```mermaid
flowchart LR
    Products[Products and prices] --> Recipes[Recipes and ingredients]
    Recipes --> Calendar[Meal calendar]
    Members[Household members] --> Calendar
    Members --> Schedule[Day schedule]
    Members --> Macros[Macro targets]

    Calendar --> Summary[Budget summary]
    Products --> Summary
    Calendar --> Export[Shopping lists and exports]
    Recipes --> Export
    Macros --> Export

    Imports[Receipt and price imports] --> Products
```

### Typical user journey

```text
Create an account
    ↓
Select UI language and product market
    ↓
Add household members
    ↓
Use system products or create personal products
    ↓
Create recipes
    ↓
Plan meals on the calendar
    ↓
Review nutrition and expenses
    ↓
Export a shopping list or printable plan
```

---

## Architecture

```mermaid
flowchart TB
    Browser[Browser]

    subgraph Frontend
        Next[Next.js 15 App Router]
        BFF[Optional BFF route handlers]
    end

    subgraph Backend
        API[FastAPI API]
        Services[Service layer]
        Worker[Optional Redis worker]
    end

    subgraph Data
        PostgreSQL[(PostgreSQL 15)]
        Redis[(Redis 7)]
    end

    subgraph External
        Google[Google OAuth]
        Gemini[Gemini]
        Pexels[Pexels]
        DeepSeek[DeepSeek]
    end

    subgraph Observability
        Prometheus[Prometheus]
        Grafana[Grafana]
    end

    Browser --> Next
    Next -->|Bearer JWT| API
    Next -->|Optional HttpOnly session| BFF
    BFF --> API

    API --> Services
    Services --> PostgreSQL
    Services --> Redis
    Redis --> Worker
    Worker --> PostgreSQL

    API --> Google
    API --> Gemini
    API --> Pexels
    API --> DeepSeek

    API -->|/metrics| Prometheus
    Prometheus --> Grafana
```

### Backend request flow

```text
HTTP request
    ↓
FastAPI route
    ↓
Authentication and database dependencies
    ↓
Domain service
    ↓
SQLAlchemy model / PostgreSQL
    ↓
Presenter
    ↓
JSON response
```

---

## Key engineering decisions

| Area | Approach |
|---|---|
| **Backend architecture** | Thin FastAPI routes with business logic in service modules |
| **Frontend architecture** | Next.js App Router with feature hooks and dedicated screen components |
| **API contract** | OpenAPI snapshot committed to the repository and TypeScript types generated from it |
| **Authentication** | Bearer JWT by default; optional Next.js BFF with an HttpOnly session cookie |
| **User isolation** | User-owned resources are scoped by authenticated user ID |
| **Household model** | Meal plans, schedules and targets can be scoped to individual members |
| **Product catalog** | Shared read-only system products plus personal copy-on-write overrides |
| **Localization** | UI language is separate from the product market |
| **Migrations** | Alembic with migration checks and PostgreSQL integration tests |
| **Deployment safety** | Railway waits for CI and runs database migrations before backend deployment |
| **Legacy migration** | Original CRA frontend retained only as an archived reference |
| **AI-assisted development** | Repository-level rules define review, testing, Git and validation policies |

---

## Technology stack

### Backend

<p>
<img src="https://img.shields.io/badge/Python_3.14-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python" />
<img src="https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI" />
<img src="https://img.shields.io/badge/Pydantic-E92063?style=flat-square&logo=pydantic&logoColor=white" alt="Pydantic" />
<img src="https://img.shields.io/badge/SQLAlchemy_2-D71F00?style=flat-square&logo=sqlalchemy&logoColor=white" alt="SQLAlchemy" />
<img src="https://img.shields.io/badge/Alembic-6BA81E?style=flat-square" alt="Alembic" />
<img src="https://img.shields.io/badge/PyJWT-000000?style=flat-square&logo=jsonwebtokens&logoColor=white" alt="PyJWT" />
<img src="https://img.shields.io/badge/Authlib-4051B5?style=flat-square" alt="Authlib" />
</p>

### Frontend

<p>
<img src="https://img.shields.io/badge/Next.js_15-000000?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js" />
<img src="https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React" />
<img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
<img src="https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
<img src="https://img.shields.io/badge/dnd--kit-5850EC?style=flat-square" alt="dnd-kit" />
<img src="https://img.shields.io/badge/date--fns-770C56?style=flat-square&logo=datefns&logoColor=white" alt="date-fns" />
</p>

### Data and infrastructure

<p>
<img src="https://img.shields.io/badge/PostgreSQL_15-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
<img src="https://img.shields.io/badge/Redis_7-DC382D?style=flat-square&logo=redis&logoColor=white" alt="Redis" />
<img src="https://img.shields.io/badge/Docker_Compose-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker Compose" />
<img src="https://img.shields.io/badge/Railway-0B0D0E?style=flat-square&logo=railway&logoColor=white" alt="Railway" />
<img src="https://img.shields.io/badge/Prometheus-E6522C?style=flat-square&logo=prometheus&logoColor=white" alt="Prometheus" />
<img src="https://img.shields.io/badge/Grafana-F46800?style=flat-square&logo=grafana&logoColor=white" alt="Grafana" />
</p>

### Testing and quality

<p>
<img src="https://img.shields.io/badge/pytest-0A9EDC?style=flat-square&logo=pytest&logoColor=white" alt="pytest" />
<img src="https://img.shields.io/badge/Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white" alt="Vitest" />
<img src="https://img.shields.io/badge/Playwright-2EAD33?style=flat-square&logo=playwright&logoColor=white" alt="Playwright" />
<img src="https://img.shields.io/badge/Ruff-D7FF64?style=flat-square&logo=ruff&logoColor=black" alt="Ruff" />
<img src="https://img.shields.io/badge/OpenAPI-6BA539?style=flat-square&logo=openapiinitiative&logoColor=white" alt="OpenAPI" />
<img src="https://img.shields.io/badge/GitHub_Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white" alt="GitHub Actions" />
</p>

### External integrations

<p>
<img src="https://img.shields.io/badge/Google_OAuth-4285F4?style=flat-square&logo=google&logoColor=white" alt="Google OAuth" />
<img src="https://img.shields.io/badge/Google_Gemini-8E75B2?style=flat-square&logo=googlegemini&logoColor=white" alt="Google Gemini" />
<img src="https://img.shields.io/badge/Pexels-05A081?style=flat-square&logo=pexels&logoColor=white" alt="Pexels" />
<img src="https://img.shields.io/badge/DeepSeek-4D6BFE?style=flat-square" alt="DeepSeek" />
</p>

---

## Quick start

### Requirements

- Docker Engine or Docker Desktop
- Docker Compose
- Git

For running services directly outside Docker:

- Python 3.14
- [`uv`](https://docs.astral.sh/uv/)
- Node.js 24+
- npm

### 1. Clone the repository

```bash
git clone https://github.com/tomekmisiun/OnTrack.git
cd OnTrack
```

### 2. Configure the environment

```bash
cp .env.example .env
```

Set secure values for at least:

```env
POSTGRES_PASSWORD=replace-me
FLASK_SECRET_KEY=replace-me
JWT_SECRET_KEY=replace-me
GF_SECURITY_ADMIN_PASSWORD=replace-me
```

Generate application secrets with:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Use a separate generated value for each secret.

### 3. Start the stack

```bash
docker compose up --build
```

### 4. Apply database migrations

```bash
docker compose exec backend sh scripts/run-migrations.sh
```

### Local services

| Service | Address |
|---|---|
| Next.js frontend | http://localhost:3000 |
| FastAPI backend | http://localhost:5001 |
| Backend health | http://localhost:5001/health |
| Backend readiness | http://localhost:5001/health/ready |
| Backend metrics | http://localhost:5001/metrics |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3001 |

### Useful Docker commands

Run services in the background:

```bash
docker compose up -d
```

Follow application logs:

```bash
docker compose logs -f frontend backend
```

Stop the stack:

```bash
docker compose down
```

### Port-conflict recovery

When ports `5432`, `6379` or `5001` are already occupied:

```bash
docker compose \
  -p ontrack-recovery \
  -f docker-compose.yml \
  -f docker-compose.recovery.yml \
  up -d db redis backend
```

Apply migrations in the recovery stack:

```bash
docker compose \
  -p ontrack-recovery \
  exec backend sh scripts/run-migrations.sh
```

---

## Environment variables

Copy `.env.example` to `.env`. Never commit the populated `.env` file.

### Required locally

| Variable | Purpose |
|---|---|
| `POSTGRES_USER` | PostgreSQL username |
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `POSTGRES_DB` | PostgreSQL database name |
| `FLASK_SECRET_KEY` | OAuth session-cookie signing secret; name retained for compatibility |
| `JWT_SECRET_KEY` | JWT signing secret |
| `FRONTEND_URL` | Allowed frontend origins for CORS |
| `GF_SECURITY_ADMIN_PASSWORD` | Grafana administrator password |
| `NEXT_PUBLIC_API_URL` | Browser-facing FastAPI URL |

### Optional integrations

| Variable | Feature |
|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `GOOGLE_REDIRECT_URI` | Google OAuth callback |
| `GEMINI_API_KEY` | AI-assisted receipt parsing |
| `PEXELS_API_KEY` | Recipe image search |
| `DEEPSEEK_API_KEY` | Macro lookup and scraper pipeline |
| `NEXT_PUBLIC_BFF_ENABLED` | Enables the optional Next.js BFF and HttpOnly session mode |
| `BACKEND_DEBUG` | Development-only backend behavior |
| `TEST_DATABASE_URL` | PostgreSQL integration tests |

> [!NOTE]
> Optional integrations degrade gracefully when their credentials are not configured, although the integration-specific feature will be unavailable.

---

## Testing and quality

The CI workflow validates backend behavior, frontend quality, API compatibility, production images and PostgreSQL migrations.

### Backend

```bash
cd backend

uv sync --dev
uv run ruff check .
uv run pytest tests/contract/ tests/test_health.py tests/test_dish_compare_data.py -q
```

Run the contract suite with coverage:

```bash
uv run pytest tests/contract/ -q \
  --cov=app \
  --cov-report=term-missing \
  --cov-fail-under=50
```

Run PostgreSQL integration tests:

```bash
TEST_DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/ontrack_test \
  uv run pytest tests/integration/ -v
```

### Frontend

```bash
cd frontend-next

npm ci
npm run generate:api
npm run test
npm run lint
npm run typecheck
npm run build
```

Run Playwright smoke tests:

```bash
npm run test:e2e
```

Run registration and login against a real FastAPI and PostgreSQL stack:

```bash
npm run test:e2e:auth
```

Run visual regression tests:

```bash
npm run test:e2e:visual
```

### CI jobs

| Job | Purpose |
|---|---|
| `test` | Ruff, catalog validation, API contract tests and coverage |
| `frontend-next` | API generation, Vitest, ESLint, TypeScript and production build |
| `frontend-next-e2e` | Playwright module smoke tests |
| `frontend-next-e2e-auth` | Real registration and login with FastAPI and PostgreSQL |
| `backend-docker` | Backend production-image build |
| `frontend-next-docker` | Frontend production-image build |
| `backend-integration` | PostgreSQL migration and schema rehearsal |

---

## API overview

Protected endpoints use:

```http
Authorization: Bearer <token>
```

| Prefix | Purpose |
|---|---|
| `/api/auth` | Registration, login, session data, language, market and Google OAuth |
| `/api/members` | Household-member CRUD and profile targets |
| `/api/products` | System catalog, personal products and overrides |
| `/api/recipes` | Recipes, ingredients, categories and favorites |
| `/api/meal-plan` | Meal-calendar entries and range queries |
| `/api/day-schedule` | Weekly schedule blocks |
| `/api/nutrition` | Macro and nutrition lookup |
| `/api/import` | Receipt, CSV and text price imports |
| `/api/fuel` | Fuel-price data used in expense calculations |
| `/api/public` | Public data such as dish-cost comparison |
| `/health` | Liveness |
| `/health/ready` | Database readiness |
| `/metrics` | Prometheus metrics |

### OpenAPI contract

The frontend contract is generated from FastAPI:

```bash
cd frontend-next

npm run export:openapi
npm run generate:api
```

Generated types are stored in:

```text
frontend-next/lib/api/generated/schema.ts
```

The committed OpenAPI snapshot is checked for drift in CI.

---

## Localization and markets

OnTrack treats the **interface language** and **product market** as separate user settings.

| Setting | Values | Controls |
|---|---|---|
| `ui_locale` | `pl`, `en` | Buttons, labels, messages and interface content |
| `market_code` | `PL`, `GB` | Product catalog, localized prices, currency and market data |

### Market behavior

| Market | Main currency | Product data |
|---|---|---|
| `PL` | PLN | Polish catalog and Polish market sources |
| `GB` | GBP | British catalog and UK market sources |

Changing the UI language does not automatically replace the user's product market.

### Catalog ownership

```text
System product
    ├── user_id = NULL
    ├── read-only shared catalog item
    └── visible for its market

Personal override
    ├── belongs to one user
    ├── references a system product
    └── replaces the shared row for that user
```

This copy-on-write model keeps the global catalog reusable while allowing every account to customize names, macros and prices.

---

## Deployment

Production is configured for **Railway**.

### Services

| Railway service | Role | Root directory |
|---|---|---|
| `ontrack-back` | FastAPI production API | `backend` |
| `ontrackapp` | Next.js production frontend | `frontend-next` |
| `ontrack-worker` | Optional Redis worker | `backend` |
| PostgreSQL | Primary database | Railway plugin |
| Redis | Queue and cache | Railway plugin |

### Deployment flow

```mermaid
flowchart LR
    Branch[Feature branch] --> PR[Pull request]
    PR --> CI[GitHub Actions]
    CI -->|green| Merge[Merge to main]
    Merge --> Railway[Railway Wait for CI]
    Railway --> Migrations[Alembic pre-deploy migrations]
    Migrations --> Deploy[Backend and frontend deployment]
```

The backend Railway configuration runs migrations through `preDeployCommand` before starting the new release.

Full deployment instructions:

- [`.github/DEPLOY.md`](.github/DEPLOY.md)
- [`docs/deployment/RAILWAY_BACKEND_MIGRATION.md`](docs/deployment/RAILWAY_BACKEND_MIGRATION.md)
- [`docs/deployment/RAILWAY_AUTH_PRODUCTION_VERIFY.md`](docs/deployment/RAILWAY_AUTH_PRODUCTION_VERIFY.md)

---

## Project status

OnTrack is a functionally mature portfolio application. Its main user journeys are implemented across the Next.js frontend, FastAPI backend and PostgreSQL database.

| Area | Status |
|---|---|
| Local Docker development | ✅ Ready |
| Portfolio presentation | ✅ Ready |
| Local product demo | ✅ Ready |
| Password registration and login | ✅ Implemented |
| Google OAuth | ✅ Implemented; live credentials required |
| Products and recipes | ✅ Implemented |
| Meal calendar | ✅ Implemented |
| Household schedules | ✅ Implemented |
| Budget summary and exports | ✅ Implemented |
| PL/EN interface | ✅ Implemented |
| PL/GB product markets | ✅ Implemented |
| FastAPI migration | ✅ Completed |
| CRA to Next.js migration | ✅ Runtime cutover completed |
| Archived CRA reference | ✅ Preserved under `archive/` |
| Monitoring endpoints | ✅ Implemented |
| Full production hardening | 🟡 Ongoing |
| Optional background worker | 🟡 Infrastructure available; limited runtime role |
| Third-party AI integrations | 🟡 Require configured external credentials |

> [!IMPORTANT]
> For the latest consolidated assessment, start with [`docs/audits/PROJECT_CURRENT_STATE_AUDIT_2026-06-26.md`](docs/audits/PROJECT_CURRENT_STATE_AUDIT_2026-06-26.md). Remediation tasks: [`docs/PROJECT_REMEDIATION_ROADMAP.md`](docs/PROJECT_REMEDIATION_ROADMAP.md). Older audits are in [`docs/audits/archive/`](docs/audits/archive/).

---

## Repository structure

```text
OnTrack/
├── backend/
│   ├── app/
│   │   ├── api/                 # FastAPI routes and dependencies
│   │   ├── core/                # Configuration, auth, rate limits and metrics
│   │   ├── domain/              # Pure domain helpers
│   │   ├── models/              # SQLAlchemy models
│   │   ├── schemas/             # Pydantic request models
│   │   ├── services/            # Business logic
│   │   └── worker/              # Redis worker infrastructure
│   ├── alembic/                 # Database migrations
│   ├── data/                    # Runtime catalogs and public datasets
│   ├── scripts/                 # Migration, validation and deployment tools
│   └── tests/                   # Contract, integration and regression tests
│
├── frontend-next/
│   ├── app/                     # Next.js routes and layouts
│   ├── components/              # Feature and shared UI components
│   ├── contexts/                # Authentication, members, language and toasts
│   ├── hooks/                   # Page-level application logic
│   ├── lib/                     # API client, auth, i18n and domain helpers
│   ├── openapi/                 # Committed API schema
│   ├── public/                  # Assets and demo media
│   ├── styles/                  # Module and global styles
│   └── tests/                   # Vitest and Playwright suites
│
├── archive/
│   ├── frontend-cra-reference/  # Archived frontend used during migration
│   └── scraper-legacy/          # Archived offline product-data pipeline (not runtime)
├── monitoring/                  # Prometheus configuration
├── docs/                        # Audits, specifications and runbooks
├── scripts/                     # Repository and AI-workflow validation
├── .ai-rules/                   # Binding development-agent rules
├── .github/workflows/           # CI pipeline
├── docker-compose.yml           # Local full stack
└── docker-compose.recovery.yml  # Alternative host ports
```

---

## Documentation

| Document | Purpose |
|---|---|
| [`docs/audits/PROJECT_CURRENT_STATE_AUDIT_2026-06-26.md`](docs/audits/PROJECT_CURRENT_STATE_AUDIT_2026-06-26.md) | **Current** technical and product audit |
| [`docs/PROJECT_REMEDIATION_ROADMAP.md`](docs/PROJECT_REMEDIATION_ROADMAP.md) | Remediation tasks and priorities |
| [`docs/audits/archive/`](docs/audits/archive/) | Historical audits and migration reports |
| [`docs/CRA_REFERENCE.md`](docs/CRA_REFERENCE.md) | Legacy frontend reference map |
| [`docs/FRONTEND_NEXT_BFF.md`](docs/FRONTEND_NEXT_BFF.md) | Optional BFF and HttpOnly-session threat model |
| [`docs/backend-migration/API_CONTRACT.md`](docs/backend-migration/API_CONTRACT.md) | API contract registry |
| [`docs/deployment/RAILWAY_BACKEND_MIGRATION.md`](docs/deployment/RAILWAY_BACKEND_MIGRATION.md) | Railway backend runbook |
| [`.github/DEPLOY.md`](.github/DEPLOY.md) | CI-gated deployment configuration |
| [`archive/scraper-legacy/README.md`](archive/scraper-legacy/README.md) | Archived scraper pipeline (not runtime) |

---

## Development workflow

The repository follows a controlled branch and review workflow:

```text
task
  ↓
feature branch
  ↓
targeted implementation
  ↓
targeted tests
  ↓
full relevant validation
  ↓
pull request
  ↓
review
  ↓
merge to main
  ↓
CI-gated Railway deployment
```

### Core rules

- one task per branch,
- no direct pushes to `main`,
- Conventional Commits,
- targeted tests before broad validation,
- database changes require Alembic migrations,
- generated OpenAPI types must stay synchronized,
- secrets must never be committed,
- automated changes must follow repository rules.

Read before contributing:

- [`AGENTS.md`](AGENTS.md)
- [`CLAUDE.md`](CLAUDE.md)
- [`.ai-rules/`](.ai-rules/)
- [`.cursor/rules/`](.cursor/rules/)

---

## License

Distributed under the **MIT License**.

See [`LICENSE`](LICENSE) for the full text.

---

## Author

<div align="center">

### Tomasz Misiun

[![GitHub](https://img.shields.io/badge/GitHub-tomekmisiun-181717?style=for-the-badge&logo=github)](https://github.com/tomekmisiun)
[![OnTrack](https://img.shields.io/badge/Project-OnTrack-63B967?style=for-the-badge&logo=github&logoColor=white)](https://github.com/tomekmisiun/OnTrack)

<br />

Built as a production-oriented full-stack portfolio project.

</div>

---

<div align="center">

**OnTrack is under active development.**

[Back to top](#readme-top)

</div>
