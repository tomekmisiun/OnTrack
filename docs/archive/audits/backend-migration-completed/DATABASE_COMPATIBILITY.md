> **HISTORICAL DOCUMENT** — Flask-era database analysis. For current state see [`docs/CURRENT_STATE.md`](../../../CURRENT_STATE.md).

# Database compatibility analysis

OnTrack uses **Flask-SQLAlchemy** models and **Flask-Migrate** (`migrations/`). The FastAPI foundation uses a **separate** Alembic tree (`alembic/` with 12 revisions for tenants, audit, uploads, etc.) — **these must not be applied to OnTrack data**.

---

## Table inventory

### `users`

| Field | Detail |
|-------|--------|
| Columns | `id` PK int; `email` varchar(255) NOT NULL UNIQUE; `username` varchar(80) NULL UNIQUE indexed; `password_hash` varchar(255) NOT NULL; `created_at` datetime NULL; `lang` varchar(5) NOT NULL default `'pl'` |
| ORM | `app/models/user.py` |
| Target | `backend/app/models/user.py` |
| Compatibility | Password hash algorithm must remain werkzeug-compatible (see AUTH_COMPATIBILITY.md) |

### `products`

| Field | Detail |
|-------|--------|
| Columns | `id` PK; `user_id` FK→users NOT NULL; `name` varchar(255); `package_weight` float; `price` float; `unit` varchar(10) default `'g'`; `kcal`,`protein`,`fat`,`carbs` float NULL; `sold_by_weight` bool default false; `lang` varchar(5) default `'pl'` |
| ORM | `app/models/product.py` |
| Indexes | Per-user+lang queries (no explicit composite index in model — **inferred** from usage) |
| Compatibility | Name length evolved 100→255 via migration `408d553cd2be` |

### `recipes`

| Field | Detail |
|-------|--------|
| Columns | `id` PK; `user_id` FK; `name` varchar(100); `notes` text NULL; `is_favorite` bool; `image_url` text NULL; `source_url` text NULL; `category` varchar(20) NULL; `servings` int default 1; `lang` varchar(5); `kcal_100g`,`protein_100g`,`fat_100g`,`carbs_100g` float NULL |
| ORM | `app/models/recipe.py` |
| Uniqueness | Was global name unique; dropped in `e5f6a7b8c9d0` — now scoped by user+lang in app logic |

### `recipe_ingredients`

| Field | Detail |
|-------|--------|
| Columns | `id` PK; `recipe_id` FK→recipes; `product_id` FK→products; `weight` float NOT NULL |
| ORM | `app/models/recipe.py` |
| ON DELETE | Cascade via recipe delete in routes |

### `meal_plans`

| Field | Detail |
|-------|--------|
| Columns | `id` PK; `user_id` FK NOT NULL; `member_id` FK→household_members NULL; `date` date; `position` int; `recipe_id` FK |
| Unique | `(member_id, date, position)` — `unique_member_date_position` |
| ORM | `app/models/meal_plan.py` |

### `household_members`

| Field | Detail |
|-------|--------|
| Columns | `id` PK; `user_id` FK; `name` varchar(80); `is_primary` bool; profile fields nullable; macro_* ints; `macro_goal_label` varchar(50) |
| ORM | `app/models/household_member.py` |

### `day_schedule_blocks`

| Field | Detail |
|-------|--------|
| Columns | `id` PK; `user_id` FK; `member_id` FK; `week_start` date; `day` int 0-6; `start_hour` int; `end_hour` int; `label` varchar(120) |
| ORM | `app/models/day_schedule.py` |
| Added | `week_start` migration `a1b2c3d4e5f6` |

### `import_logs`

| Field | Detail |
|-------|--------|
| Columns | `id` PK; `user_id` FK; `date` date; `count` int default 0 |
| Unique | `(user_id, date)` — `uq_import_log_user_date` |

### `recipe_parse_logs`

| Field | Detail |
|-------|--------|
| Columns | Same pattern as import_logs |
| Unique | `(user_id, date)` — `uq_recipe_parse_log` |
| Usage | Account delete only — no API route |

### `auth_codes`

| Field | Detail |
|-------|--------|
| Columns | `id` PK; `code` varchar(64) UNIQUE indexed; `user_id` FK ON DELETE CASCADE; `created_at`, `expires_at`, `used_at` datetime |
| ORM | `app/models/auth_code.py` |

---

## Migration history (Flask)

20 revisions from `b1f3c7f7e6a2_initial` (2026-05-12) through latest. Chain is linear (**confirmed** from `migrations/versions/` filenames and `down_revision` fields).

Initial schema had global unique product/recipe names and no users — evolved significantly.

---

## Scenario A — Fresh installation

**Goal:** Empty Postgres → full OnTrack schema via new `backend/alembic/`.

| Step | Action |
|------|--------|
| 1 | Create **new** Alembic env under `backend/alembic/` |
| 2 | Single initial revision (or squashed chain) reflecting **current** model definitions — generate from SQLAlchemy models, compare to merged Flask head |
| 3 | `alembic upgrade head` on empty DB |
| 4 | Verify with pytest + smoke tests |

**Do not** copy foundation `648d963688dd_add_user_role.py` or downstream tenant/upload migrations.

---

## Scenario B — Existing Railway production database

**Goal:** Attach FastAPI to live data without `CREATE TABLE` collisions.

### Preconditions (all required before `alembic stamp`)

1. **Verified backup** — Railway snapshot or `pg_dump` to secure storage; restore tested on disposable instance.
2. **Schema dump** — `pg_dump --schema-only` from production.
3. **Model-to-DB comparison** — Autogenerate revision in dry-run mode against copy; diff must be empty or documented.
4. **Drift detection** — Compare Flask `migrations/` head to actual prod schema (manual or `alembic check` after stamp).
5. **Staging rehearsal** — Full cutover drill on DB **clone**, not production.

### Recommended adoption strategy

```
┌─────────────────────────────────────────────────────────┐
│ 1. Restore prod backup → staging Postgres             │
│ 2. Flask continues writing (prod) during dev            │
│ 3. FastAPI staging points at staging DB clone           │
│ 4. Build backend/alembic revision(s) that are NO-OP     │
│    on existing schema OR only add new alembic_version   │
│ 5. alembic stamp <ontrack_head_revision> on staging   │
│ 6. Run contract + migration tests                       │
│ 7. Production cutover: deploy FastAPI, same DATABASE_URL│
│ 8. stamp production ONLY after schema parity proven     │
└─────────────────────────────────────────────────────────┘
```

### Never do

- Run foundation template migrations on OnTrack DB.
- Run a greenfield `CREATE TABLE users` migration on production.
- `alembic stamp head` without schema parity checklist signed off.

### Rollback (database)

- FastAPI deploy rollback → revert Railway to Flask service image.
- DB schema unchanged if migration phase was stamp-only or no-op.
- If forward migration applied, require documented `downgrade()` per revision (Flask chain has downgrades; new backend chain should include them for staging).

---

## `alembic_version` table

| System | Table | Expected content |
|--------|-------|------------------|
| Flask (current) | `alembic_version` | Flask migration head revision id |
| FastAPI (after stamp) | `alembic_version` | `7966d120d748` — see [DB_REHEARSAL.md](./DB_REHEARSAL.md) |

**Risk (HIGH):** Two Alembic environments may fight over `alembic_version` if both run upgrades. **Decision:** After cutover, only FastAPI runs migrations; Flask decommissioned.

---

## Foundation DB objects (must NOT appear in OnTrack)

From template `alembic/versions/` (v1.0.0):

- `tenants`, tenant membership tables
- `audit_logs`
- `password_reset_tokens`, `password_reset_job_completions`
- `uploaded_files`
- `idempotency_keys`, `webhook_events`
- Template `users` shape (email login, `token_version`, `role`)

**Classification:** REMOVE from OnTrack schema unless explicitly added later.

---

## Compatibility issues summary

| Issue | Severity | Mitigation |
|-------|----------|------------|
| Two Alembic histories | BLOCKER | New `backend/alembic/` with OnTrack-only revisions |
| Foundation vs OnTrack `users` table | BLOCKER | Keep OnTrack columns; do not import template User model |
| `postgres://` URL | MEDIUM | Normalize to `postgresql://` (already in `config.py`) |
| SQLite tests vs Postgres prod | MEDIUM | Add Postgres integration tests in MIG-013 |
| Recipe create/update weight semantics | MEDIUM | Port logic exactly in service layer |
| Member_id NULL legacy meals | LOW | `meal_plan` routes handle legacy `user_id` fallback |

---

## Validation after migration

- [ ] Row counts match for all tables (staging rehearsal).
- [ ] Sample user login + CRUD smoke tests.
- [ ] Unique constraints enforced (`member_id+date+position`, `auth_codes.code`).
- [ ] Foreign keys intact.
- [ ] `alembic current` shows expected head on staging and prod.
