# Deploy — GitHub Actions → Railway

Deploys run from [`.github/workflows/ci.yml`](workflows/ci.yml) after CI passes on **`main`**. Staging is automatic; production requires GitHub Environment approval.

**Full runbook:** [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md)

---

## Railway project

One Railway project with two **environments**: `staging` and `production`.

| Service | Role | Root Directory | Config |
|---------|------|----------------|--------|
| `ontrack-back` | FastAPI API | `backend` | `/backend/railway.toml` |
| `ontrackapp` | Next.js frontend | `frontend-next` | `/frontend-next/railway.toml` |
| Postgres | Database | — | One plugin per environment |

Each environment has its own Postgres, domains, and variables. Migrations run via `preDeployCommand` in `backend/railway.toml` against that environment's `DATABASE_URL`.

---

## Release flow (push to `main`)

```text
PR → CI → merge to main
→ CI (7 jobs)
→ deploy-staging (GitHub Environment: staging)
→ wait-staging-ready
→ staging-smoke
→ deploy-production (GitHub Environment: production — manual approval)
→ production-smoke
```

There is **no** `git push staging production` and **no** deploy branch.

Both deploy jobs checkout and deploy **`github.sha`** from the workflow run — not latest `main` after approval.

---

## GitHub Environments

| Environment | Secrets (examples) | Purpose |
|-------------|-------------------|---------|
| `staging` | `RAILWAY_TOKEN`, `STAGING_API_URL`, `STAGING_FRONTEND_ORIGIN` | Auto deploy + smoke |
| `production` | `RAILWAY_TOKEN`, `PRODUCTION_API_URL`, `PRODUCTION_FRONTEND_ORIGIN` | Deploy after approval + smoke |

Configure under **Settings → Environments**. Production should have **Required reviewers**.

---

## Approve production

After merge to `main`:

1. **GitHub → Actions → CI/CD Pipeline** — open the run for your commit
2. Wait for **Staging auth smoke** to pass (green)
3. **Review deployments** (or the pending `Deploy to Railway (production)` job)
4. Select **production** → **Approve and deploy**
5. Wait for **Production auth smoke (post-deploy)** to pass

---

## CI jobs

| Job | When | Purpose |
|-----|------|---------|
| `test`, `frontend-next`, e2e, docker, integration | PR + `main` | Quality gates |
| `deploy-staging` | `main` push only | `railway up --environment staging` |
| `wait-staging-ready` | after staging deploy | Poll `/health/ready` |
| `staging-smoke` | after readiness | Auth smoke on staging |
| `deploy-production` | after staging smoke + approval | `railway up --environment production` |
| `production-smoke` | after production deploy | Readiness + auth smoke |

Optional (not part of release gate): **Visual regression**, **Production auth smoke** (scheduled), **Staging auth smoke** (manual).

Full matrix: [`docs/TESTING.md`](../docs/TESTING.md)

---

## Concurrency

| Group | `cancel-in-progress` | Effect |
|-------|---------------------|--------|
| `ci-…-refs/heads/main` | false | CI runs complete on main |
| `deploy-staging-main` | true | Staging deploy, readiness wait, and smoke share one group — superseded runs do not approve production on stale staging |
| `deploy-production-main` | false | Approved production deploy is not cancelled by newer pushes |

---

## Quick verification (local / ops)

```bash
curl -sf https://<api-domain>/health/ready

API_URL=https://<api-domain> FRONTEND_ORIGIN=https://<frontend-domain> \
  ./backend/scripts/verify-production-auth.sh
```

---

## Branch protection

Recommended required checks on `main`: **`test`**, **`frontend-next`**

Do not push directly to `main`.
