# Documentation archive

Point-in-time audits, completed migration plans, and superseded workflow docs. **Do not use as current operational instructions.**

## Canonical docs (active)

| Topic | Document |
|-------|----------|
| Index | [../README.md](../README.md) |
| Project state | [../project/current-state.md](../project/current-state.md) |
| Roadmap | [../project/roadmap.md](../project/roadmap.md) |
| Technical debt | [../project/tech-debt.md](../project/tech-debt.md) |
| Architecture | [../architecture/overview.md](../architecture/overview.md) |
| Local development | [../development/README.md](../development/README.md) |
| AI workflows | [../development/ai/workflows.md](../development/ai/workflows.md) |
| Deployment | [../operations/deployment.md](../operations/deployment.md) |
| Testing | [../testing/README.md](../testing/README.md) |
| Security | [../security/overview.md](../security/overview.md) |
| API contract | [../specs/api-contract.md](../specs/api-contract.md) |
| ADRs | [../adr/](../adr/) |

## Categories

| Path | Contents |
|------|----------|
| [audits/](./audits/) | Historical audits (2026-05/06), migration-era reports |
| [completed-migrations/](./completed-migrations/) | Flask→FastAPI migration docs (complete) |
| [completed-plans/](./completed-plans/) | Finished roadmap and resolved tech-debt entries |
| [superseded/](./superseded/) | Replaced AI workflow docs (merged into `development/ai/workflows.md`) |

## Validation

Files under `docs/archive/` are excluded from markdown link checks in `scripts/validate-ai-workflows.sh`. Broken links to removed paths are expected in historical snapshots.
