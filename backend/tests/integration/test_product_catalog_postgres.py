"""PostgreSQL integration tests documenting product delete behavior with recipe FKs."""

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
from app.models.recipe import Recipe, RecipeIngredient
from app.models.user import User
from app.services import product_service
from sqlalchemy import inspect, text
from sqlalchemy.engine import create_engine
from sqlalchemy.orm import Session, sessionmaker

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
def migrated_postgres(postgres_url: str, monkeypatch):
    """Fresh schema via Alembic upgrade."""
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
    command.upgrade(alembic_cfg, "head")

    session_factory = sessionmaker(bind=create_engine(postgres_url))
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


def _create_user_with_product_and_recipe(session: Session) -> tuple[User, Product, Recipe]:
    user = User(
        email="fk-test@example.com",
        username="fktest",
        lang="pl",
        password_hash=hash_password("test-password"),
    )
    session.add(user)
    session.flush()
    session.add(HouseholdMember(user_id=user.id, name="Ja", is_primary=True))
    product = Product(
        user_id=user.id,
        source="user",
        normalized_name=normalize_product_name("Produkt FK"),
        name="Produkt FK",
        package_weight=500,
        price=2.5,
        unit="g",
        lang="pl",
    )
    session.add(product)
    session.flush()
    recipe = Recipe(name="Test recipe", user_id=user.id, category="lunch", lang="pl", servings=1)
    session.add(recipe)
    session.flush()
    session.add(RecipeIngredient(recipe_id=recipe.id, product_id=product.id, weight=100))
    session.commit()
    session.refresh(user)
    session.refresh(product)
    session.refresh(recipe)
    return user, product, recipe


def test_delete_product_referenced_by_recipe_returns_409_on_postgres(migrated_postgres: Session):
    """Service blocks delete with 409 when product is referenced by recipe ingredients."""
    session = migrated_postgres
    user, product, recipe = _create_user_with_product_and_recipe(session)

    with pytest.raises(product_service.ProductServiceError) as exc_info:
        product_service.delete_product(session, user.id, product.id)
    assert exc_info.value.status_code == 409

    assert session.get(Product, product.id) is not None
    assert (
        session.query(RecipeIngredient)
        .filter_by(recipe_id=recipe.id, product_id=product.id)
        .count()
        == 1
    )


def test_sqlite_delete_product_in_recipe_returns_409(db_session, user, product):
    """SQLite harness enforces the same 409 guard as PostgreSQL."""
    recipe = Recipe(name="SQLite FK", user_id=user.id, category="lunch", lang="pl", servings=1)
    db_session.add(recipe)
    db_session.flush()
    db_session.add(RecipeIngredient(recipe_id=recipe.id, product_id=product.id, weight=50))
    db_session.commit()

    with pytest.raises(product_service.ProductServiceError) as exc_info:
        product_service.delete_product(db_session, user.id, product.id)
    assert exc_info.value.status_code == 409
    assert db_session.get(Product, product.id) is not None


def test_recipe_ingredients_fk_exists_on_postgres(migrated_postgres: Session, postgres_url: str):
    """Confirm migration defines FK from recipe_ingredients.product_id to products.id."""
    engine = create_engine(postgres_url)
    with engine.connect() as conn:
        fks = inspect(conn).get_foreign_keys("recipe_ingredients")
    engine.dispose()
    product_fk = next((fk for fk in fks if "product_id" in fk.get("constrained_columns", [])), None)
    assert product_fk is not None
    assert product_fk["referred_table"] == "products"
