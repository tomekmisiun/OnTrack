# OnTrack

Meal planning, nutrition targets, and household food budgeting in one workspace.

[![CI](https://github.com/tomekmisiun/OnTrack/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/tomekmisiun/OnTrack/actions/workflows/ci.yml)

**Stack:** FastAPI · Next.js 15 · PostgreSQL 15 · Railway

---

## Table of contents

- [What it does](#what-it-does)
- [Architecture](#architecture)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Development](#development)
- [Testing](#testing)
- [Validation and linting](#validation-and-linting)
- [Deployment](#deployment)
- [Security and limitations](#security-and-limitations)
- [Documentation index](#documentation-index)
- [Repository layout](#repository-layout)

---

## What it does

OnTrack helps households plan meals, track nutrition targets, and manage a food budget in one app.

- Plan meals on a calendar with household members
- Manage products and recipes (user catalog + global system catalog)
- Set macro/nutrition targets and day schedules
- Budget summary and CSV export
- Register/login and optional Google OAuth
- UI locale (PL/EN) separate from product market (PL/GB)

---

## Architecture

```
Browser → Next.js (frontend-next) → FastAPI (backend) → PostgreSQL
```

Production runs on Railway with two environments: `staging` (automatic after CI on `main`) and `production` (manual GitHub Environment approval after staging smoke).

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## Requirements

| Tool | Version | Used for |
|------|---------|----------|
| Docker + Compose | recent | Recommended local stack |
| Python | 3.14 | Backend (`uv`) |
| Node.js | 24 | Frontend (matches CI) |
| PostgreSQL | 15 | Database (Compose or local) |

---

## Quick start

```bash
cp .env.example .env
# Set POSTGRES_*, FLASK_SECRET_KEY, JWT_SECRET_KEY

docker compose up --build
```

| Service | URL |
|---------|-----|
| App | http://localhost:3000 |
| API | http://localhost:5001 |
| API docs | http://localhost:5001/docs |

Without Docker: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)

---

## Configuration

Copy `.env.example` → `.env`. Minimum for local run:

| Variable | Purpose |
|----------|---------|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Database |
| `FLASK_SECRET_KEY` | OAuth session cookie signing |
| `JWT_SECRET_KEY` | JWT signing |
| `NEXT_PUBLIC_API_URL` | Frontend → API URL (default `http://localhost:5001`) |

Optional: `GOOGLE_*`, `GEMINI_API_KEY`, `PEXELS_API_KEY`, `DEEPSEEK_API_KEY`, `SMTP_*` (password reset email).

Full list: [.env.example](.env.example) and [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

---

## Development

### Backend (without Compose)

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
| Fast backend subset (CI-equivalent) | `make test` |
| Backend without Postgres | `make test-backend` |
| Backend integration (Postgres) | `make test-integration` |
| Frontend unit | `make test-frontend` |
| AI workflow validation | `make validate` |

Full strategy, CI mapping, and examples: [docs/TESTING.md](docs/TESTING.md)

---

## Validation and linting

```bash
make validate                                    # AI rules / workflow files
cd backend && uv run ruff check .               # Python lint
cd frontend-next && npm run lint && npm run typecheck
cd frontend-next && npm run build               # production build check
```

OpenAPI drift is checked in CI — regenerate after backend schema changes:

```bash
cd frontend-next && npm run export:openapi && npm run generate:api
```

---

## Deployment

Push to `main` after green CI:

1. Deploy to Railway **staging**
2. Staging readiness + auth smoke (`verify-production-auth.sh`)
3. Manual approval for **production** (GitHub Environment)
4. Production readiness + auth smoke

Runbook: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) · Operator quick reference: [.github/DEPLOY.md](.github/DEPLOY.md)

---

## Security and limitations

- JWT stored in `localStorage` by default; optional BFF cookie mode for local dev ([docs/SECURITY.md](docs/SECURITY.md))
- Password reset requires SMTP on backend (`SMTP_HOST`, `SMTP_FROM`) for email delivery
- Catalog import runs on deploy — see [docs/TECH_DEBT.md](docs/TECH_DEBT.md) TD-003

Current status: [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md)

---

## Documentation index

| Document | Contents |
|----------|----------|
| [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md) | Verified feature status |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Components and data flow |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Local setup and commands |
| [docs/TESTING.md](docs/TESTING.md) | Test strategy and CI |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Railway deploy and smoke |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Active plans |
| [docs/TECH_DEBT.md](docs/TECH_DEBT.md) | Open technical debt |
| [docs/SECURITY.md](docs/SECURITY.md) | Auth and secrets |
| [docs/backend-migration/API_CONTRACT.md](docs/backend-migration/API_CONTRACT.md) | API contract (binding) |
| [docs/adr/](docs/adr/) | Architecture decision records |

Agent workflow: [AGENTS.md](AGENTS.md), [.ai-rules/](.ai-rules/)

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

## Author

See [GitHub repository](https://github.com/tomekmisiun/OnTrack) for license and contribution policy.
