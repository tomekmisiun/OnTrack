# Deploy — Wait for CI (Railway + GitHub Actions)

Produkcja deployuje się z Railway po pushu na `main`, **ale tylko gdy GitHub Actions (job `test`) przejdzie**. Nie trzeba sekretów Railway w GitHub.

## 1. Railway — oba serwisy (`ontrack-back`, `ontrackapp`)

Dla **każdego** serwisu osobno → **Settings** → **Source**:

1. **Source Repo** — podpięte do `tomekmislun/Meal-planner-and-budgeter`
2. **Branch connected to production** → **`main`** (Connect Environment to Branch, jeśli odłączone)
3. **Auto deploys when pushed to GitHub** — **włączone** (nie klikaj Disable)
4. **Wait for CI** → **ON**

Powtórz dla backendu i frontendu. Kliknij **Apply** / **Deploy**, jeśli Railway pokazuje pending changes.

## 2. GitHub Actions

Workflow `.github/workflows/ci.yml` uruchamia tylko **test** (pytest).

```
push main → job test
              ✅ → Railway czeka i deployuje z GitHub
              ❌ → Railway pomija deploy (SKIPPED)
```

PR na `main` → tylko test, bez deployu.

## 3. Branch protection (GitHub)

**Settings → Branches → Add rule** dla `main`:

- Require a pull request before merging
- Require status checks to pass: **`test`**

## 4. Workflow deweloperski

```
feature branch → Pull Request → test (CI)
                              → merge po review + zielone CI
main push       → test → Railway deploy (Wait for CI)
```

**Nie pushuj bezpośrednio na `main`.**

## 5. Lokalnie vs produkcja

| Środowisko | Jak uruchomić |
|------------|----------------|
| Dev | `docker compose up` |
| Produkcja | merge na `main` + zielony CI → Railway auto-deploy |

## Troubleshooting

- Deploy nie startuje po pushu → sprawdź, czy branch `main` jest podpięty i Wait for CI włączone
- Deploy mimo failu CI → Wait for CI wyłączone albo workflow nie ma `on: push: branches: [main]`
- Status `WAITING` w Railway → normalne, czeka na GitHub Actions

Docs: [Railway — Wait for CI](https://docs.railway.com/deployments/github-autodeploys#wait-for-ci)
