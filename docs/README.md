# OnTrack documentation

Index of active project documentation. Start with [CURRENT_STATE.md](./CURRENT_STATE.md) for verified feature status, or the root [README.md](../README.md) for quick start.

**Last verified:** 2026-06-28

---

## Getting started

| Document | Description |
|----------|-------------|
| [../README.md](../README.md) | Project entry — quick start, commands, links |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Local setup, env vars, migrations |
| [CURRENT_STATE.md](./CURRENT_STATE.md) | What works today — routes, CI, environments |

---

## Architecture

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Components, request flow, deploy-time catalog |
| [adr/](./adr/) | Architecture decision records |
| [backend-migration/API_CONTRACT.md](./backend-migration/API_CONTRACT.md) | Binding frontend ↔ API contract |

---

## Development and testing

| Document | Description |
|----------|-------------|
| [TESTING.md](./TESTING.md) | Test strategy, CI job matrix, commands |
| [../frontend-next/README.md](../frontend-next/README.md) | Next.js frontend structure and scripts |
| [../backend/README.md](../backend/README.md) | FastAPI backend quick reference |

---

## Deployment and operations

| Document | Description |
|----------|-------------|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Railway staging/production pipeline |
| [../.github/DEPLOY.md](../.github/DEPLOY.md) | Operator quick reference (CI-gated deploy) |
| [backend-migration/DB_REHEARSAL.md](./backend-migration/DB_REHEARSAL.md) | Legacy DB stamp rehearsal (historical procedure) |

---

## Security

| Document | Description |
|----------|-------------|
| [SECURITY.md](./SECURITY.md) | Auth, secrets, BFF mode, optional Sentry |

---

## Planning

| Document | Description |
|----------|-------------|
| [ROADMAP.md](./ROADMAP.md) | Active future work |
| [TECH_DEBT.md](./TECH_DEBT.md) | Confirmed open technical debt |

---

## Backend migration (reference)

Migration from Flask/CRA is **complete**. These docs remain for contract and historical context:

| Document | Description |
|----------|-------------|
| [backend-migration/README.md](./backend-migration/README.md) | Index of migration docs |
| [backend-migration/AUTH_COMPATIBILITY.md](./backend-migration/AUTH_COMPATIBILITY.md) | Auth parity notes |
| [backend-migration/DATABASE_COMPATIBILITY.md](./backend-migration/DATABASE_COMPATIBILITY.md) | Schema strategy |
| [backend-migration/ARCHIVED_CUTOVER_DOCS.md](./backend-migration/ARCHIVED_CUTOVER_DOCS.md) | Index of archived cutover docs |

---

## Agent workflow

| Document | Description |
|----------|-------------|
| [ai-workflows.md](./ai-workflows.md) | AI workflow index |
| [two-agent-review-workflow.md](./two-agent-review-workflow.md) | Builder / Reviewer pattern |
| [../AGENTS.md](../AGENTS.md) | Agent entry index |
| [../.ai-rules/](../.ai-rules/) | Binding agent rules |

Tool-specific: [CURSOR.md](./CURSOR.md) · [CLAUDE_CODE.md](./CLAUDE_CODE.md) · [CODEX_CLI.md](./CODEX_CLI.md) · [CROSS_PROVIDER_REVIEW.md](./CROSS_PROVIDER_REVIEW.md)

---

## Archive

Point-in-time audits and migration history — **not current operational docs**:

| Location | Description |
|----------|-------------|
| [audits/archive/](./audits/archive/) | Historical audits (2026-05/06) |
| [../archive/](../archive/) | Old frontend/scraper snapshots (not deployed) |

See [audits/archive/README.md](./audits/archive/README.md) for the archive index.
