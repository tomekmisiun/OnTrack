"""Compare live Postgres schema to FastAPI SQLAlchemy models."""

from __future__ import annotations

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy.engine import Engine

from app.models import Base

# FastAPI Alembic head — stamp target for existing Flask databases (initial schema).
ONTRACK_ALEMBIC_HEAD = "7966d120d748"
ONTRACK_ALEMBIC_CATALOG_HEAD = "e7f8a9b0c1d2"


def collect_schema_diffs(engine: Engine) -> list:
    """Return Alembic autogenerate diffs (empty list = parity)."""
    with engine.connect() as conn:
        ctx = MigrationContext.configure(conn)
        return compare_metadata(ctx, Base.metadata)


def assert_schema_parity(engine: Engine) -> None:
    diffs = collect_schema_diffs(engine)
    if diffs:
        lines = [f"  {d}" for d in diffs]
        raise AssertionError(
            "Schema drift between database and SQLAlchemy models:\n" + "\n".join(lines)
        )
