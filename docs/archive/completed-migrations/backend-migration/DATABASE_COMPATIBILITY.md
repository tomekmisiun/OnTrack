# Database compatibility

**Production:** PostgreSQL 15, schema managed by Alembic in `backend/alembic/`. Models in `backend/app/models/`.

Verify migration head:

```bash
cd backend && uv run alembic current
```

Overview: [`docs/CURRENT_STATE.md`](../CURRENT_STATE.md) · Rehearsal runbook: [DB_REHEARSAL.md](./DB_REHEARSAL.md)

---

## Rules

1. Only **`backend/alembic/`** revisions apply to OnTrack databases — never import unrelated Alembic trees from other projects.
2. Production deploy runs migrations via `backend/scripts/run-migrations.sh` (Alembic → catalog import → user-reference restore).
3. Password hashes remain werkzeug-compatible (see [AUTH_COMPATIBILITY.md](./AUTH_COMPATIBILITY.md)).

---

## Historical analysis

Flask-era table inventory and cutover planning notes:

[`docs/audits/archive/backend-migration-completed/DATABASE_COMPATIBILITY.md`](../audits/archive/backend-migration-completed/DATABASE_COMPATIBILITY.md)

Do not follow Flask rollback or greenfield `CREATE TABLE` instructions from archived docs.
