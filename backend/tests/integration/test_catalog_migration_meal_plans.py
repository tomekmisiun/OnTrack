"""Integration test: catalog migration preserves meal_plans on system recipes."""

from __future__ import annotations

import os
from datetime import date
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from app.core.config import get_settings
from app.core.passwords import hash_password
from app.domain.catalog_seed import slug_catalog_key
from app.scripts.import_catalog import import_catalog
from app.scripts.restore_post_catalog_migration import restore_post_catalog_migration
from sqlalchemy import text
from sqlalchemy.engine import create_engine
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


def test_catalog_migration_preserves_meal_plans_on_system_recipes(
    postgres_url: str, monkeypatch
) -> None:
    """Simulates Railway prod: meal_plans -> system recipe survives b1c2 + import + restore."""
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
            "email": "meal@example.com",
            "username": "mealuser",
            "password_hash": hash_password("test-password"),
            "ui_locale": "pl",
            "market_code": "PL",
        },
    ).scalar_one()
    member_id = session.execute(
        text(
            """
            INSERT INTO household_members (user_id, name, is_primary)
            VALUES (:user_id, 'Ja', true)
            RETURNING id
            """
        ),
        {"user_id": user_id},
    ).scalar_one()

    catalog_key = slug_catalog_key("https://mealpreponfleek.com/air-fried-apple-chips/")
    old_recipe_id = session.execute(
        text(
            """
            INSERT INTO recipes (
                user_id, source, catalog_key, name, market_code, lang,
                category, servings, is_favorite, kcal_100g, protein_100g, fat_100g, carbs_100g
            )
            VALUES (
                NULL, 'system', :catalog_key, 'Kanapka testowa', 'PL', 'pl',
                'lunch', 1, false, 0, 0, 0, 0
            )
            RETURNING id
            """
        ),
        {"catalog_key": catalog_key},
    ).scalar_one()
    session.execute(
        text(
            """
            INSERT INTO meal_plans (user_id, member_id, date, position, recipe_id)
            VALUES (:user_id, :member_id, :meal_date, 1, :recipe_id)
            """
        ),
        {
            "user_id": user_id,
            "member_id": member_id,
            "meal_date": date(2026, 6, 27),
            "recipe_id": old_recipe_id,
        },
    )
    session.commit()
    session.close()

    command.upgrade(cfg, "head")

    session = Session()
    import_catalog(session)
    restore_post_catalog_migration(session)
    session.commit()

    row = session.execute(
        text(
            """
            SELECT mp.recipe_id, r.catalog_key
            FROM meal_plans mp
            JOIN recipes r ON r.id = mp.recipe_id
            WHERE mp.user_id = :user_id
              AND mp.member_id = :member_id
              AND mp.date = :meal_date
              AND mp.position = 1
            """
        ),
        {"user_id": user_id, "member_id": member_id, "meal_date": date(2026, 6, 27)},
    ).one()
    session.close()

    assert row.catalog_key == catalog_key
    assert row.recipe_id != old_recipe_id
