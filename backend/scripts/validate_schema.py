#!/usr/bin/env python3
"""Validate Postgres schema parity with FastAPI SQLAlchemy models (MIG-015)."""

from __future__ import annotations

import os
import sys

from sqlalchemy import create_engine, text

from app.db.schema_validate import ONTRACK_ALEMBIC_HEAD, assert_schema_parity


def _database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("ERROR: DATABASE_URL is required", file=sys.stderr)
        sys.exit(1)
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://") and "+psycopg" not in url:
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


def main() -> int:
    url = _database_url()
    engine = create_engine(url)

    with engine.connect() as conn:
        version = conn.execute(
            text("SELECT version_num FROM alembic_version LIMIT 1")
        ).scalar_one_or_none()

    print(f"alembic_version: {version or '(missing)'}")
    print(f"expected head:   {ONTRACK_ALEMBIC_HEAD}")

    if version != ONTRACK_ALEMBIC_HEAD:
        print(
            f"WARNING: alembic_version is not stamped to FastAPI head ({ONTRACK_ALEMBIC_HEAD})",
            file=sys.stderr,
        )

    try:
        assert_schema_parity(engine)
    except AssertionError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    finally:
        engine.dispose()

    print("Schema parity OK (empty diff).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
