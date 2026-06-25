# Target architecture

Monorepo layout after migration (Flask `app/` remains until MIG-017):

```text
OnTrack/
├── frontend/                 # unchanged React app
├── backend/                  # new FastAPI service
│   ├── app/
│   │   ├── main.py           # FastAPI factory, middleware, router mount
│   │   ├── api/
│   │   │   ├── dependencies.py   # get_db, get_current_user_id, lang
│   │   │   └── routes/
│   │   │       ├── auth.py
│   │   │       ├── members.py
│   │   │       ├── products.py
│   │   │       ├── recipes.py
│   │   │       ├── meal_plan.py
│   │   │       ├── day_schedule.py
│   │   │       ├── nutrition.py
│   │   │       ├── import_prices.py
│   │   │       ├── fuel.py
│   │   │       ├── public.py
│   │   │       └── health.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── security.py       # JWT issue/verify (OnTrack-compatible)
│   │   │   ├── passwords.py      # werkzeug hash verify
│   │   │   └── logging.py
│   │   ├── db/
│   │   │   ├── session.py
│   │   │   └── base.py
│   │   ├── models/               # SQLAlchemy — OnTrack tables only
│   │   ├── schemas/              # Pydantic — mirror to_dict() contracts
│   │   ├── services/             # business logic
│   │   │   ├── auth_service.py
│   │   │   ├── catalog_seed_service.py
│   │   │   ├── macro_lookup.py   # port from Flask
│   │   │   ├── meal_plan_service.py
│   │   │   └── ...
│   │   ├── domain/               # optional pure helpers (dates, overlap)
│   │   └── worker/
│   │       ├── consumer.py
│   │       └── jobs.py
│   ├── alembic/
│   ├── tests/
│   │   ├── contract/             # frontend JSON shape tests
│   │   ├── integration/
│   │   └── unit/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── Makefile                  # trimmed from foundation
│   └── README.md
├── app/                      # legacy Flask — frozen during migration
├── migrations/               # legacy Flask-Migrate — frozen after baseline
├── docker-compose.yml        # app (flask) + backend + frontend + db + redis
└── docs/backend-migration/
```

---

## Layer responsibilities

### Router (`app/api/routes/`)

- Parse HTTP: path, query, headers, status codes.
- Depend on `get_current_user_id` / DB session.
- Call **one** service method per use case.
- Map domain errors → HTTP exceptions matching Flask messages.
- **Compatibility adapters:** return `{ "token": ... }` at boundary.

### Schema (`app/schemas/`)

- Pydantic v2 models for request validation.
- Response models configured with `model_config` to match exact JSON keys (`goalLabel` in macro_goals).
- Separate **internal** schemas from **contract** response builders if needed.

### Service (`app/services/`)

- Business rules, transactions, orchestration.
- No `Request` / `Response` objects.
- Raises domain exceptions (`NotFound`, `Conflict`, `ValidationError`).

### Repository (`app/repositories/` — optional)

Use **only** when query logic is reused or complex:

| Use repository | Skip repository |
|----------------|-----------------|
| Meal plan queries with eager loads | Simple `get_by_id` once |
| Member scoping helpers | Single-line filters |
| Import product matching | — |

Prefer **narrow services** over repository-per-entity boilerplate.

### Model (`app/models/`)

- SQLAlchemy 2.0 mapped classes matching existing tables.
- **No** `to_dict()` on models — use schema serializers (explicit contract layer).

---

## API mounting

```text
/health                    → health router (no /api prefix)
/api/auth/*                → auth router
/api/products/*            → products router
...                        → same prefixes as Flask
```

**Do not** mount foundation `/api/v1` prefix unless frontend is updated (out of scope).

---

## Parallel Flask + FastAPI (migration period)

```text
docker-compose.yml (dev)

  frontend:3000  → REACT_APP_API_URL=http://localhost:5001

  # Switch target via env:
  backend_fastapi:5001→8000   # target
  app (flask):5002→5000       # fallback / comparison
```

**Inferred dev pattern:** Use compose profile or env `API_BACKEND=flask|fastapi` to select which service binds host `5001`.

---

## Data & static assets

| Asset | Location |
|-------|----------|
| Dish compare JSON | `backend/app/dish_compare/data/` (copy from Flask) |
| User seeds | `backend/app/user_seeds/data/` |
| Macro AI cache | `backend/app/data/macro_ai_cache.json` (gitignored) |
| Scraper data | Stays in repo root `scraper/` — not in API process |

---

## Worker jobs (MIG-012)

| Job | Replaces |
|-----|----------|
| `catalog_seed` | `auth._schedule_catalog_seed` thread |
| `recipe_image_backfill` | Optional — same seed pipeline |

Queue: Redis list or foundation worker pattern — **ADAPT** simplified job table.

---

## What we explicitly do not add (yet)

- Tenant middleware
- Refresh token endpoints exposed to frontend
- S3/MinIO upload pipeline
- Webhook receivers
- Repository layer for every entity

---

## Python version

| Component | Version |
|-----------|---------|
| OnTrack CI (current) | 3.14 |
| Foundation default | 3.13+ |
| **Target backend** | **3.14** (align with CI and existing Dockerfile) |

---

## Testing layout

```text
backend/tests/contract/test_auth_contract.py
backend/tests/contract/test_products_contract.py
...
backend/tests/integration/test_postgres_meal_plan.py
backend/tests/unit/test_meal_plan_summary_math.py
```

Contract tests are the gate for each MIG-* domain task.
