# Deploy — CI → Railway

Produkcja deployuje się **wyłącznie z GitHub Actions**, po przejściu testów. Push na `main` sam w sobie nie powinien uruchamiać osobnego buildu w Railway.

## 1. Wyłącz auto-deploy w Railway

Dla **backendu** i **frontendu** (każdy serwis osobno):

1. Railway → serwis → **Settings** → **Source** / **Deploy**
2. Odłącz repozytorium GitHub **albo** wyłącz „Deploy on push” / „Automatic deployments”

Bez tego Railway nadal zbuduje aplikację przy każdym pushu, niezależnie od CI.

## 2. Sekrety w GitHub

**Settings → Secrets and variables → Actions** → New repository secret:

| Sekret | Skąd wziąć |
|--------|------------|
| `RAILWAY_TOKEN` | Railway → Project → **Settings** → **Tokens** → Project Token |
| `RAILWAY_BACKEND_SERVICE_ID` | Backend service → **Settings** → Service ID |
| `RAILWAY_FRONTEND_SERVICE_ID` | Frontend service → **Settings** → Service ID |

## 3. Workflow

```
feature branch → Pull Request → job test (pytest)
                              → merge do main (po review + zielone CI)
main push       → test → deploy (railway up backend + frontend)
```

**Nie pushuj bezpośrednio na `main`.** Użyj PR, żeby zepsuty kod nie trafił na produkcję.

## 4. Branch protection (GitHub)

**Settings → Branches → Add rule** dla `main`:

- Require a pull request before merging
- Require status checks to pass: **`test`**
- (Opcjonalnie) Do not allow bypassing the above settings

## 5. Lokalnie vs produkcja

| Środowisko | Jak uruchomić |
|------------|----------------|
| Dev | `docker compose up` (Dockerfile + Dockerfile.dev) |
| Produkcja | tylko przez CI po merge na `main` |

Docker Hub **nie jest używany** — obrazy nie są pushowane do rejestru zewnętrznego.
