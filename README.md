# OnTrack

Meal planning, nutrition targets, and household food budgeting in one workspace.

[![CI](https://github.com/tomekmisiun/OnTrack/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/tomekmisiun/OnTrack/actions/workflows/ci.yml)

**Stack:** FastAPI · Next.js 15 · PostgreSQL 15 · Railway

---

## What it does

- Plan meals on a calendar with household members
- Manage products and recipes (user catalog + global system catalog)
- Set macro/nutrition targets
- Day schedule, budget summary, and CSV export
- Register/login and optional Google OAuth
- UI locale (PL/EN) separate from product market (PL/GB)

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

Without Docker: see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

---

## Environment variables

Copy `.env.example` → `.env`. Minimum for local run:

| Variable | Purpose |
|----------|---------|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Database |
| `FLASK_SECRET_KEY` | OAuth session cookie signing |
| `JWT_SECRET_KEY` | JWT signing |
| `NEXT_PUBLIC_API_URL` | Frontend → API URL (default `http://localhost:5001`) |

Optional: `GOOGLE_*`, `GEMINI_API_KEY`, `PEXELS_API_KEY`, `DEEPSEEK_API_KEY`.

Full list: [.env.example](.env.example) and [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

---

## Testing

```bash
make test                              # backend contract subset
cd backend && uv run pytest -q         # full backend
cd frontend-next && npm run test       # Vitest
cd frontend-next && npm run test:e2e   # Playwright smoke
```

CI matrix and integration tests: [docs/TESTING.md](docs/TESTING.md).

---

## Architecture (simplified)

```
Browser → Next.js (frontend-next) → FastAPI (backend) → PostgreSQL
```

Production: Railway (`staging` then `production` environments). Deploy via GitHub Actions after CI on `main` — staging first, manual approval for production.

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## Documentation

| Document | Contents |
|----------|----------|
| [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md) | What exists today |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Components and data flow |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Local setup and commands |
| [docs/TESTING.md](docs/TESTING.md) | CI and test commands |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Railway deploy and verification |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Active plans |
| [docs/TECH_DEBT.md](docs/TECH_DEBT.md) | Known technical debt |
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

## Limitations

- Password reset: configure SMTP on backend (`SMTP_HOST`, `SMTP_FROM`) for email delivery
- JWT stored in `localStorage` by default (optional BFF cookie mode for local dev)
- Production smoke tests are manual — see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

Current status: [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md)

---

## Author

See [GitHub repository](https://github.com/tomekmisiun/OnTrack) for license and contribution policy.
