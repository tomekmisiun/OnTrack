# Database adoption rehearsal (MIG-015)

Validate that FastAPI can attach to an **existing Flask-migrated** Postgres database using **`alembic stamp` only** — no `CREATE TABLE` on production data.

**Prerequisite:** A FastAPI staging service deployed against a **clone** DB (operator-managed; see [DEPLOYMENT.md](../DEPLOYMENT.md) § Staging).

---

## Goals

| Check | Pass criteria |
|-------|---------------|
| Schema parity | Alembic autogenerate diff vs SQLAlchemy models is **empty** |
| Stamp | `alembic_version` = `7966d120d748` (FastAPI head) |
| No-op upgrade | `alembic upgrade head` applies zero DDL |
| Data intact | Row counts unchanged; login + CRUD smoke pass |
| Rollback | Flask still works against same DB after stamp (no schema change) |

---

## Constants

| Name | Value |
|------|-------|
| FastAPI Alembic head | `7966d120d748` |
| Flask migration head | `a1b2c3d4e5f6` (before stamp) |
| OnTrack tables | 10 — see `backend/app/models/tables.py` |

---

## Phase A — Preconditions (clone DB)

Run on **staging clone only**.

- [ ] Verified backup of production exists and restore was tested
- [ ] Clone DB attached to staging FastAPI (not live prod)
- [ ] `SELECT version_num FROM alembic_version` shows Flask head (`a1b2c3d4e5f6`) or later Flask revision
- [ ] All 10 OnTrack tables present
- [ ] Row counts recorded (see queries below)

### Row count snapshot

```sql
SELECT 'users' AS t, COUNT(*) FROM users
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'recipes', COUNT(*) FROM recipes
UNION ALL SELECT 'meal_plans', COUNT(*) FROM meal_plans
UNION ALL SELECT 'household_members', COUNT(*) FROM household_members;
```

Save output before stamp.

---

## Phase B — Schema dump and parity

### B1. Schema-only dump (optional audit)

```bash
pg_dump --schema-only "$DATABASE_URL" > staging_clone_schema.sql
```

Compare against a fresh `alembic upgrade head` on empty DB if investigating drift.

### B2. Automated parity check

From `backend/` with `DATABASE_URL` set to **clone**:

```bash
uv sync
uv run python scripts/validate_schema.py
```

Expected: `Schema parity OK (empty diff).`

If drift is reported, fix SQLAlchemy models or document intentional differences in [DATABASE_COMPATIBILITY.md](./DATABASE_COMPATIBILITY.md) before stamping.

---

## Phase C — Alembic stamp (no DDL)

### Option 1 — Script

```bash
cd backend
export DATABASE_URL='postgresql+psycopg://...'   # clone only
chmod +x scripts/db_rehearsal_stamp.sh
./scripts/db_rehearsal_stamp.sh
```

### Option 2 — Manual steps

```bash
cd backend
export DATABASE_URL='postgresql+psycopg://...'

# 1. Confirm parity
uv run python scripts/validate_schema.py

# 2. Stamp FastAPI head (replaces Flask revision id in alembic_version)
uv run alembic stamp --purge 7966d120d748

# 3. Confirm
uv run alembic current
# → 7966d120d748 (head)

# 4. Must be no-op
uv run alembic upgrade head
uv run python scripts/validate_schema.py
```

**Never** run `alembic upgrade head` before stamp on a Flask database — the initial revision contains `CREATE TABLE`.

---

## Phase D — Smoke checklist (staging API)

After stamp, against staging FastAPI URL:

- [ ] `GET /health` → 200
- [ ] Login **existing** user (Flask password hash)
- [ ] Register new user → `{ "token" }` → `GET /api/auth/me`
- [ ] `GET /api/members/`
- [ ] Product CRUD
- [ ] Recipe list + create
- [ ] Meal plan add/list/summary
- [ ] `GET /api/public/dish-compare?lang=pl`
- [ ] Row counts match Phase A snapshot

Contract suite (optional, against staging):

```bash
cd backend
uv run pytest tests/contract/ -q
```

---

## Phase E — Rollback drill

Confirms stamp did not alter schema — Flask must still work.

1. Point a test client at Flask service with **same clone** `DATABASE_URL`
2. Login existing user
3. `GET /api/products/` returns data
4. No migration errors in Flask logs

Production rollback to Flask is **obsolete**. See archived [CUTOVER_AND_ROLLBACK.md](../audits/archive/backend-migration-completed/CUTOVER_AND_ROLLBACK.md) for historical context only.

---

## Automated CI rehearsal

GitHub Actions job `backend-integration` runs:

1. Empty Postgres → Flask `db upgrade` (simulates clone)
2. `alembic stamp 7966d120d748`
3. Assert schema diff empty
4. `alembic upgrade head` no-op

Local (requires Postgres):

```bash
cd backend && uv sync --dev
export TEST_DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/ontrack_rehearsal
uv run pytest tests/integration/test_migrations_stamp.py -v
```

---

## Production cutover gate (MIG-016)

Do **not** stamp production until:

- [ ] Full rehearsal signed off on staging clone (this document)
- [ ] Schema parity script passes on clone
- [ ] Smoke checklist green
- [ ] Rollback drill confirmed
- [ ] Final prod backup taken

Production stamp uses the same commands with **production** `DATABASE_URL` during the cutover window only.

---

## Troubleshooting

| Symptom | Action |
|---------|--------|
| `CREATE TABLE` errors on upgrade | You ran `upgrade` before `stamp` — restore clone from backup |
| Schema drift after stamp | Compare Flask models vs `backend/app/models/`; fix models, re-test on fresh clone |
| `alembic_version` missing | Clone corrupt — restore backup |
| Login fails after stamp | JWT/secret mismatch — not a DB issue; check env vars |
| Flask head revision differs | Any Flask head is OK if schema matches current models; stamp still sets `7966d120d748` |

---

## Related docs

- [DATABASE_COMPATIBILITY.md](./DATABASE_COMPATIBILITY.md) — table inventory, adoption strategy
- [DEPLOYMENT.md](../DEPLOYMENT.md) — staging and production deploy
- [CUTOVER_AND_ROLLBACK.md](../audits/archive/backend-migration-completed/CUTOVER_AND_ROLLBACK.md) — historical cutover phases (Flask rollback not applicable)
