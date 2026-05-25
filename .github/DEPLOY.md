# Deploy — Wait for CI (Railway + GitHub Actions)

Production deploys from Railway after a push to `main`, **but only when GitHub Actions (job `test`) passes**. You do not need Railway secrets in GitHub.

## 1. Railway — both services (`ontrack-back`, `ontrackapp`)

For **each** service separately → **Settings** → **Source**:

1. **Source Repo** — connected to `tomekmislun/Meal-planner-and-budgeter`
2. **Branch connected to production** → **`main`** (Connect Environment to Branch if disconnected)
3. **Auto deploys when pushed to GitHub** — **enabled** (do not click Disable)
4. **Wait for CI** → **ON**

Repeat for backend and frontend. Click **Apply** / **Deploy** if Railway shows pending changes.

## 2. GitHub Actions

The workflow `.github/workflows/ci.yml` runs only **test** (pytest).

```
push to main → job test
                 ✅ → Railway waits and deploys from GitHub
                 ❌ → Railway skips deploy (SKIPPED)
```

PR to `main` → test only, no deploy.

## 3. Branch protection (GitHub)

**Settings → Branches → Add rule** for `main`:

- Require a pull request before merging
- Require status checks to pass: **`test`**

## 4. Developer workflow

```
feature branch → Pull Request → test (CI)
                               → merge after review + green CI
push to main     → test → Railway deploy (Wait for CI)
```

**Do not push directly to `main`.**

## 5. Local vs production

| Environment | How to run |
|-------------|------------|
| Dev | `docker compose up` |
| Production | merge to `main` + green CI → Railway auto-deploy |

## Troubleshooting

- Deploy does not start after push → check that branch `main` is connected and Wait for CI is enabled
- Deploy despite failed CI → Wait for CI is off or the workflow is missing `on: push: branches: [main]`
- Status `WAITING` in Railway → normal; waiting for GitHub Actions

Docs: [Railway — Wait for CI](https://docs.railway.com/deployments/github-autodeploys#wait-for-ci)
