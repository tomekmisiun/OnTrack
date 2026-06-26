# Production readiness matrix

**Baseline audit:** [`docs/audits/PROJECT_CURRENT_STATE_AUDIT_2026-06-26.md`](audits/PROJECT_CURRENT_STATE_AUDIT_2026-06-26.md)  
**Last updated:** 2026-06-26  

| Area | Status | Verification | Owner action |
|------|--------|--------------|--------------|
| Frontend (Next.js 15) | **ACTIVE** | `cd frontend-next && npm run test && npm run build` | Keep middleware/auth docs current |
| FastAPI API | **ACTIVE** | `cd backend && uv run pytest -q` | Monitor cold-start catalog load |
| Auth JWT (default) | **ACTIVE** | `pytest tests/contract/test_auth_contract.py` | See ADR 0001 for BFF |
| BFF / HttpOnly cookies | **OPTIONAL** | Set `NEXT_PUBLIC_BFF_ENABLED=1` locally | ADR 0001 — off in prod |
| PostgreSQL + Alembic | **ACTIVE** | CI `backend-integration`; Railway preDeploy logs | Confirm head after deploy |
| Redis / worker | **REMOVED** | No worker package; no Redis in Compose | ADR 0002 |
| Scraper pipeline | **DEPRECATED** | `archive/scraper-legacy/` only | Do not re-enable in runtime |
| `/health`, `/health/ready` | **ACTIVE** | `curl /health/ready` | Railway healthcheck |
| `/metrics` | **ACTIVE** | `curl /metrics \| grep ontrack_` | Local Prometheus only |
| Prometheus (local) | **OPTIONAL** | `docker compose up prometheus` → :9090 | Not on Railway |
| Grafana (local) | **PARTIAL** | `docker compose up grafana` → :3001, login admin | Provisioned datasource |
| Railway deploy | **ACTIVE** | CI job `deploy-production` green | `RAILWAY_TOKEN` secret |
| CI contract subset | **ACTIVE** | GitHub Actions on PR | See `docs/TESTING.md` |
| OpenAPI drift | **ACTIVE** | CI checks `openapi.json` + `schema.ts` | Regenerate after API changes |
| Password reset API | **PARTIAL** | Token returned only in debug/testing | No email in prod |
| Google OAuth | **ACTIVE** | Configure `GOOGLE_CLIENT_*` on Railway | Live credentials required |
| DeepSeek macro lookup | **OPTIONAL** | `DEEPSEEK_API_KEY`; catalog-first | Graceful degrade |
| Gemini / Pexels | **OPTIONAL** | Import and recipe image features | Graceful degrade |
| Production auth smoke | **ACTIVE** | `./backend/scripts/verify-production-auth.sh` | Runbook below |

## Pre-release checklist

- [ ] All CI jobs green on `main`
- [ ] `deploy-production` succeeded
- [ ] `curl -sf $API_URL/health/ready`
- [ ] `API_URL=... FRONTEND_ORIGIN=... ./backend/scripts/verify-production-auth.sh`
- [ ] Browser login/register on production frontend
- [ ] Alembic pre-deploy shows `(head)` in Railway logs

## Runbooks

- Deploy: [`.github/DEPLOY.md`](../.github/DEPLOY.md)
- Auth smoke: [`docs/deployment/RAILWAY_AUTH_PRODUCTION_VERIFY.md`](deployment/RAILWAY_AUTH_PRODUCTION_VERIFY.md)
- Remediation tasks: [`docs/PROJECT_REMEDIATION_ROADMAP.md`](PROJECT_REMEDIATION_ROADMAP.md)
