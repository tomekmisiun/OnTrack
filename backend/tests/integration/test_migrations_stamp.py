"""Rehearse adopting an existing database via alembic stamp (MIG-015)."""

from __future__ import annotations

import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from app.core.config import get_settings
from app.db.schema_validate import (
    ONTRACK_ALEMBIC_CATALOG_HEAD,
    ONTRACK_ALEMBIC_HEAD,
    assert_schema_parity,
    collect_schema_diffs,
)
from app.models.tables import ONTRACK_TABLES
from sqlalchemy import create_engine, inspect, text

BACKEND_ROOT = Path(__file__).resolve().parents[2]

# Legacy Flask-Migrate revision id (pre-cutover prod databases; not a FastAPI revision).
LEGACY_FLASK_ALEMBIC_HEAD = "flask_legacy_placeholder"


def _postgres_test_url() -> str | None:
    url = os.environ.get("TEST_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not url or not url.startswith("postgresql"):
        return None
    if "+psycopg" not in url:
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


@pytest.fixture
def postgres_url() -> str:
    url = _postgres_test_url()
    if url is None:
        pytest.skip("Set TEST_DATABASE_URL (postgresql+psycopg://...) to run integration tests")
    return url


@pytest.fixture
def legacy_migrated_postgres(postgres_url: str, monkeypatch) -> str:
    """Empty schema → FastAPI upgrade → legacy alembic_version (simulates pre-stamp prod)."""
    engine = create_engine(postgres_url, isolation_level="AUTOCOMMIT")
    with engine.connect() as conn:
        conn.execute(
            text(
                """
                DROP SCHEMA public CASCADE;
                CREATE SCHEMA public;
                GRANT ALL ON SCHEMA public TO public;
                """
            )
        )
    engine.dispose()

    monkeypatch.setenv("DATABASE_URL", postgres_url)
    get_settings.cache_clear()

    alembic_cfg = Config(str(BACKEND_ROOT / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    command.upgrade(alembic_cfg, ONTRACK_ALEMBIC_HEAD)

    engine = create_engine(postgres_url)
    with engine.connect() as conn:
        conn.execute(
            text("UPDATE alembic_version SET version_num = :rev"),
            {"rev": LEGACY_FLASK_ALEMBIC_HEAD},
        )
        conn.commit()
    engine.dispose()

    return postgres_url


def test_stamp_existing_schema_has_empty_diff(legacy_migrated_postgres: str, monkeypatch) -> None:
    """Legacy alembic_version → stamp initial FastAPI → upgrade catalog migration → parity."""
    monkeypatch.setenv("DATABASE_URL", legacy_migrated_postgres)
    get_settings.cache_clear()

    engine = create_engine(legacy_migrated_postgres)
    with engine.connect() as conn:
        tables = set(inspect(conn).get_table_names())
        version = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
    assert ONTRACK_TABLES <= tables
    assert version == LEGACY_FLASK_ALEMBIC_HEAD

    alembic_cfg = Config(str(BACKEND_ROOT / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    command.stamp(alembic_cfg, ONTRACK_ALEMBIC_HEAD, purge=True)

    with engine.connect() as conn:
        stamped = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
    assert stamped == ONTRACK_ALEMBIC_HEAD

    # Pre-catalog schema: models include catalog columns — drift expected until upgrade.
    assert collect_schema_diffs(engine)  # noqa: not empty before upgrade

    command.upgrade(alembic_cfg, "head")

    with engine.connect() as conn:
        after_upgrade = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
    assert after_upgrade == ONTRACK_ALEMBIC_CATALOG_HEAD
    assert_schema_parity(engine)
    engine.dispose()
