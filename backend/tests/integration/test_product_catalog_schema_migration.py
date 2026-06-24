"""Integration tests for global product catalog schema migration."""

from __future__ import annotations

import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from app.core.config import get_settings
from app.core.passwords import hash_password
from app.domain.product_normalize import normalize_product_name
from app.models.household_member import HouseholdMember
from app.models.product import Product
from sqlalchemy import inspect, text
from sqlalchemy.engine import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

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
def legacy_migrated_db(postgres_url: str, monkeypatch):
    """Initial schema + one legacy product row, then upgrade to catalog migration head."""
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

    cfg = Config(str(BACKEND_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    command.upgrade(cfg, "7966d120d748")

    Session = sessionmaker(bind=create_engine(postgres_url))
    session = Session()
    user_id = session.execute(
        text(
            """
            INSERT INTO users (email, username, password_hash, lang)
            VALUES (:email, :username, :password_hash, :lang)
            RETURNING id
            """
        ),
        {
            "email": "mig@example.com",
            "username": "miguser",
            "password_hash": hash_password("test-password"),
            "lang": "pl",
        },
    ).scalar_one()
    session.add(HouseholdMember(user_id=user_id, name="Ja", is_primary=True))
    session.flush()
    session.execute(
        text(
            """
            INSERT INTO products
                (user_id, name, package_weight, price, unit, sold_by_weight, lang)
            VALUES
                (:user_id, 'Mleko', 1000, 3.0, 'ml', false, 'pl')
            """
        ),
        {"user_id": user_id},
    )
    session.commit()
    legacy_id = session.execute(text("SELECT id FROM products LIMIT 1")).scalar_one()
    session.close()

    command.upgrade(cfg, "head")

    yield postgres_url, legacy_id

    cleanup = Session()
    cleanup.execute(text("DELETE FROM products WHERE source = 'system'"))
    cleanup.commit()
    cleanup.close()

    command.downgrade(cfg, "7966d120d748")
    command.downgrade(cfg, "base")


def test_migration_backfills_legacy_product(legacy_migrated_db):
    postgres_url, legacy_id = legacy_migrated_db
    Session = sessionmaker(bind=create_engine(postgres_url))
    session = Session()
    product = session.get(Product, legacy_id)
    assert product is not None
    assert product.user_id is not None
    assert product.source == "legacy"
    assert product.normalized_name == normalize_product_name("Mleko")
    assert product.catalog_key is None
    session.close()


def test_migration_system_product_constraints(legacy_migrated_db):
    postgres_url, _legacy_id = legacy_migrated_db
    Session = sessionmaker(bind=create_engine(postgres_url))
    session = Session()

    session.add(
        Product(
            user_id=None,
            source="system",
            catalog_key="demo:milk",
            normalized_name=normalize_product_name("Mleko"),
            name="Mleko",
            package_weight=1000,
            price=3.0,
            unit="ml",
            lang="pl",
        )
    )
    session.commit()

    dup = Product(
        user_id=None,
        source="system",
        catalog_key="demo:milk",
        normalized_name=normalize_product_name("Mleko 2"),
        name="Mleko 2",
        package_weight=500,
        price=2.0,
        unit="ml",
        lang="pl",
    )
    session.add(dup)
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()

    invalid = Product(
        user_id=None,
        source="system",
        catalog_key=None,
        normalized_name="x",
        name="X",
        package_weight=1,
        price=1,
        unit="g",
        lang="pl",
    )
    session.add(invalid)
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()
    session.close()


def test_migration_indexes_exist(legacy_migrated_db):
    postgres_url, _ = legacy_migrated_db
    engine = create_engine(postgres_url)
    with engine.connect() as conn:
        indexes = {idx["name"] for idx in inspect(conn).get_indexes("products")}
    engine.dispose()
    assert "ix_products_user_id_lang" in indexes
    assert "ix_products_lang_normalized_name" in indexes
    assert "uq_products_lang_catalog_key_system" in indexes
