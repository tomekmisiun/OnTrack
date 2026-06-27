"""Integration tests for locale/market catalog schema migration."""

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
from app.models.product_market_price import ProductMarketPrice
from app.models.product_translation import ProductTranslation
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
    command.upgrade(cfg, "a2b3c4d5e6f7")

    Session = sessionmaker(bind=create_engine(postgres_url))
    session = Session()
    user_id = session.execute(
        text(
            """
            INSERT INTO users (email, username, password_hash, ui_locale, market_code)
            VALUES (:email, :username, :password_hash, :ui_locale, :market_code)
            RETURNING id
            """
        ),
        {
            "email": "mig@example.com",
            "username": "miguser",
            "password_hash": hash_password("test-password"),
            "ui_locale": "pl",
            "market_code": "PL",
        },
    ).scalar_one()
    session.add(HouseholdMember(user_id=user_id, name="Ja", is_primary=True))
    session.flush()
    session.execute(
        text(
            """
            INSERT INTO products
                (user_id, name, package_weight, price, unit, sold_by_weight, lang, market_code, source)
            VALUES
                (:user_id, 'Mleko', 1000, 3.0, 'ml', false, 'pl', 'PL', 'user')
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


def test_migration_backfills_legacy_product(legacy_migrated_db):
    postgres_url, legacy_id = legacy_migrated_db
    Session = sessionmaker(bind=create_engine(postgres_url))
    session = Session()
    product = session.get(Product, legacy_id)
    assert product is not None
    assert product.user_id is not None
    assert product.user_name == "Mleko"
    assert product.normalized_name == normalize_product_name("Mleko")
    assert product.catalog_key is None
    prices = session.query(ProductMarketPrice).filter_by(product_id=legacy_id).all()
    assert len(prices) == 1
    assert prices[0].market_code == "PL"
    assert prices[0].amount == 3.0
    session.close()


def test_migration_system_product_constraints(legacy_migrated_db):
    postgres_url, _legacy_id = legacy_migrated_db
    Session = sessionmaker(bind=create_engine(postgres_url))
    session = Session()

    product = Product(
        user_id=None,
        source="system",
        catalog_key="demo-milk",
        normalized_name=normalize_product_name("Mleko"),
        kcal=0,
        protein=0,
        fat=0,
        carbs=0,
    )
    product.translations.append(ProductTranslation(locale="pl", name="Mleko"))
    product.market_prices.append(
        ProductMarketPrice(
            market_code="PL",
            amount=3.0,
            currency="PLN",
            package_weight=1000,
            unit="ml",
            sold_by_weight=False,
        )
    )
    session.add(product)
    session.commit()

    dup = Product(
        user_id=None,
        source="system",
        catalog_key="demo-milk",
        normalized_name=normalize_product_name("Mleko 2"),
        kcal=0,
        protein=0,
        fat=0,
        carbs=0,
    )
    session.add(dup)
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()
    session.close()


def test_migration_translation_tables_exist(legacy_migrated_db):
    postgres_url, _ = legacy_migrated_db
    engine = create_engine(postgres_url)
    with engine.connect() as conn:
        tables = set(inspect(conn).get_table_names())
    engine.dispose()
    assert "product_translations" in tables
    assert "product_market_prices" in tables
    assert "recipe_translations" in tables
