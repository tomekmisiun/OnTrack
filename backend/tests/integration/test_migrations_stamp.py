"""Rehearse adopting an existing Flask-migrated database via alembic stamp (MIG-015)."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from app.core.config import get_settings
from app.db.schema_validate import ONTRACK_ALEMBIC_HEAD, assert_schema_parity
from app.models.tables import ONTRACK_TABLES
from sqlalchemy import create_engine, inspect, text

BACKEND_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_ROOT.parent


def _postgres_test_url() -> str | None:
    url = os.environ.get("TEST_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not url or not url.startswith("postgresql"):
        return None
    if "+psycopg" not in url:
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


def _upgrade_flask_schema(postgres_url: str) -> None:
    """Apply Flask-Migrate chain (simulates production clone schema)."""
    if str(REPO_ROOT) not in sys.path:
        sys.path.insert(0, str(REPO_ROOT))

    try:
        from app import create_app
        from flask_migrate import upgrade
    except ImportError as exc:
        pytest.skip(f"Flask app not available for rehearsal test: {exc}")

    flask_url = postgres_url.replace("postgresql+psycopg://", "postgresql://", 1)
    app = create_app()
    app.config["SQLALCHEMY_DATABASE_URI"] = flask_url
    with app.app_context():
        upgrade()


@pytest.fixture
def postgres_url() -> str:
    url = _postgres_test_url()
    if url is None:
        pytest.skip("Set TEST_DATABASE_URL (postgresql+psycopg://...) to run integration tests")
    return url


@pytest.fixture
def flask_migrated_postgres(postgres_url: str) -> str:
    """Empty schema → Flask db upgrade (simulates production clone)."""
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

    _upgrade_flask_schema(postgres_url)
    return postgres_url


def test_stamp_existing_flask_schema_has_empty_diff(flask_migrated_postgres: str, monkeypatch) -> None:
    """Flask head schema → alembic stamp → no drift vs SQLAlchemy models."""
    monkeypatch.setenv("DATABASE_URL", flask_migrated_postgres)
    get_settings.cache_clear()

    engine = create_engine(flask_migrated_postgres)
    with engine.connect() as conn:
        tables = set(inspect(conn).get_table_names())
        version = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
    assert ONTRACK_TABLES <= tables
    assert version is not None
    assert version != ONTRACK_ALEMBIC_HEAD

    alembic_cfg = Config(str(BACKEND_ROOT / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    command.stamp(alembic_cfg, ONTRACK_ALEMBIC_HEAD)

    with engine.connect() as conn:
        stamped = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
    assert stamped == ONTRACK_ALEMBIC_HEAD

    assert_schema_parity(engine)

    command.upgrade(alembic_cfg, "head")

    with engine.connect() as conn:
        after_upgrade = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
    assert after_upgrade == ONTRACK_ALEMBIC_HEAD
    assert_schema_parity(engine)
    engine.dispose()
