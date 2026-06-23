import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from app.core.config import get_settings
from app.models.tables import FOUNDATION_FORBIDDEN_TABLES, ONTRACK_TABLES
from sqlalchemy import inspect, text
from sqlalchemy.engine import create_engine

BACKEND_ROOT = Path(__file__).resolve().parents[2]


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
def fresh_postgres(postgres_url: str):
    """Empty public schema, then yield URL for alembic upgrade."""
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
    yield postgres_url


def test_migrations_fresh_creates_ontrack_schema_only(fresh_postgres: str, monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_URL", fresh_postgres)
    get_settings.cache_clear()

    alembic_cfg = Config(str(BACKEND_ROOT / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    command.upgrade(alembic_cfg, "head")

    engine = create_engine(fresh_postgres)
    with engine.connect() as conn:
        tables = set(inspect(conn).get_table_names())

    engine.dispose()

    assert ONTRACK_TABLES <= tables
    assert tables - ONTRACK_TABLES == {"alembic_version"}
    assert tables.isdisjoint(FOUNDATION_FORBIDDEN_TABLES)
