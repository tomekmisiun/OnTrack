# OnTrack

**Meal planning, nutrition targets, and household food budgeting** — one workspace for the whole household.

[![CI](https://github.com/tomekmisiun/OnTrack/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/tomekmisiun/OnTrack/actions/workflows/ci.yml)
[![Python](https://img.shields.io/badge/Python-3.14-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Railway](https://img.shields.io/badge/Deploy-Railway-0B0D0E?logo=railway&logoColor=white)](https://railway.com/)

---

### About

**OnTrack** helps households plan meals, track nutrition, and control food spending without juggling spreadsheets and separate apps.

- **Meal calendar** — plan meals with household members, drag-and-drop, favorites
- **Products & recipes** — user catalog plus global system catalog by market
- **Nutrition & schedule** — macro targets and day schedule per member
- **Budget & export** — summary views and CSV export
- **Auth** — register/login, optional Google OAuth, password reset (with SMTP)
- **Locale vs market** — UI language (PL/EN) separate from product market (PL/GB)

> [!TIP]
> Verified feature list and routes: [docs/project/current-state.md](docs/project/current-state.md)

---

### Stack

```
Browser → Next.js (frontend-next) → FastAPI (backend) → PostgreSQL 15
```

| Layer | Technology |
|-------|------------|
| API | FastAPI, Alembic, pytest |
| Frontend | Next.js 15, React 19, Vitest |
| Database | PostgreSQL 15 |
| Deploy | Railway (`staging` → smoke → `production`) |
| CI | GitHub Actions — 5 PR jobs |

Architecture details: [docs/architecture/overview.md](docs/architecture/overview.md)

---

## Table of contents

- [Requirements](#requirements)
- [How to — quick start](#how-to--quick-start)
- [Configuration](#configuration)
- [Development](#development)
- [Testing](#testing)
- [Validation](#validation)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [Repository layout](#repository-layout)

---

## Requirements

| Tool | Version | Purpose |
|------|---------|---------|
| **Docker + Compose** | recent | Recommended local stack |
| **Python** | 3.14 | Backend ([uv](https://docs.astral.sh/uv/)) |
| **Node.js** | 24 | Frontend (matches CI) |
| **PostgreSQL** | 15 | Database |

Without Docker: see [docs/development/README.md](docs/development/README.md).

---

## How to — quick start

Run following commands from the repository root.

First, configure environment:

```bash
cp .env.example .env
# Edit .env — minimum: POSTGRES_*, FLASK_SECRET_KEY, JWT_SECRET_KEY
```

Then start the stack:

```bash
docker compose up --build
```

| Service | URL |
|---------|-----|
| **App** | http://localhost:3000 |
| **API** | http://localhost:5001 |
| **API docs** | http://localhost:5001/docs |

---

## Configuration

Copy `.env.example` → `.env`. Never commit `.env`.

| Variable | Purpose |
|----------|---------|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Database credentials |
| `FLASK_SECRET_KEY` | OAuth session cookie signing |
| `JWT_SECRET_KEY` | JWT signing |
| `NEXT_PUBLIC_API_URL` | Frontend → API URL (default `http://localhost:5001`) |

Optional: `GOOGLE_*`, `GEMINI_API_KEY`, `PEXELS_API_KEY`, `DEEPSEEK_API_KEY`, `SMTP_*` (password reset email).

Full reference: [.env.example](.env.example) · [docs/development/README.md](docs/development/README.md)

---

## Development

### Backend

```bash
cd backend
uv sync --dev
export DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/mealplanner
export FLASK_SECRET_KEY=dev-secret JWT_SECRET_KEY=dev-jwt-secret
export FRONTEND_URL=http://localhost:3000
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 5001
```

### Frontend

```bash
cd frontend-next
npm ci
export NEXT_PUBLIC_API_URL=http://localhost:5001
npm run dev
```

Open http://localhost:3000

---

## Testing

| Scope | Command |
|-------|---------|
| **Backend CI subset** | `make test` |
| **Backend without Postgres** | `make test-backend` |
| **Backend integration** | `make test-integration` *(requires `TEST_DATABASE_URL`)* |
| **Frontend unit** | `make test-frontend` |

> [!IMPORTANT]
> Playwright / browser E2E was removed. Strategy, CI mapping, and accepted gaps: [docs/testing/README.md](docs/testing/README.md)

---

## Validation

```bash
make validate                 # AI rules / workflow files
make test && make test-frontend
cd backend && uv run ruff check .
cd frontend-next && npm run lint && npm run typecheck && npm run build
```

After backend schema changes, regenerate OpenAPI types:

```bash
cd frontend-next && npm run export:openapi && npm run generate:api
```

---

## Deployment

Push to `main` after green CI:

1. Deploy to Railway **staging**
2. Staging readiness + auth smoke
3. Manual GitHub Environment approval for **production**
4. Production readiness + auth smoke

Runbook: [docs/operations/deployment.md](docs/operations/deployment.md) · [`.github/DEPLOY.md`](.github/DEPLOY.md)

> [!IMPORTANT]
> JWT is stored in `localStorage` by default. Password reset needs SMTP. See [docs/security/overview.md](docs/security/overview.md) and [docs/project/tech-debt.md](docs/project/tech-debt.md).

---

## Documentation

Full index: **[docs/README.md](docs/README.md)**

| Document | Contents |
|----------|----------|
| [docs/project/current-state.md](docs/project/current-state.md) | What works today |
| [docs/architecture/overview.md](docs/architecture/overview.md) | Components and data flow |
| [docs/development/README.md](docs/development/README.md) | Local setup |
| [docs/testing/README.md](docs/testing/README.md) | Test strategy and CI |
| [docs/operations/deployment.md](docs/operations/deployment.md) | Railway deploy |
| [docs/security/overview.md](docs/security/overview.md) | Auth and secrets |
| [docs/project/roadmap.md](docs/project/roadmap.md) | Active plans |
| [docs/project/tech-debt.md](docs/project/tech-debt.md) | Open technical debt |
| [docs/specs/api-contract.md](docs/specs/api-contract.md) | API contract (binding) |
| [docs/adr/](docs/adr/) | Architecture decisions |

Agent workflow: [AGENTS.md](AGENTS.md) · [.ai-rules/](.ai-rules/)

---

## Repository layout

```
backend/           FastAPI API, Alembic, tests
frontend-next/     Production Next.js frontend
docs/              Documentation
archive/           Historical snapshots (not deployed)
.ai-rules/         Agent binding rules
```

---

**OnTrack** — meal planner & budgeter for households.

See [GitHub repository](https://github.com/tomekmisiun/OnTrack) for license and contribution policy.
