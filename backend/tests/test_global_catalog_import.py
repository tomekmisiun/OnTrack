"""Tests for global catalog import (``import_catalog``)."""

from __future__ import annotations

from app.models.product import Product
from app.models.recipe import Recipe
from app.scripts.import_catalog import (
    catalog_key_for_product,
    catalog_key_for_recipe,
    import_catalog,
)


def test_catalog_key_for_product_is_stable():
    key = catalog_key_for_product("PL", 42, "banana-banan-7zl")
    assert key == catalog_key_for_product("PL", 42, "banana-banan-7zl")
    assert key == "catalog:pl:00042:banana-banan-7zl"


def test_catalog_key_for_recipe_uses_stable_key():
    key = catalog_key_for_recipe("PL", 3, "air-fried-apple-chips")
    assert key == "recipe:pl:00003:air-fried-apple-chips"


def test_import_catalog_creates_system_products(db_session):
    report = import_catalog(db_session)
    assert report.products_created >= 1
    system = (
        db_session.query(Product)
        .filter_by(source="system", market_code="PL")
        .filter(Product.user_id.is_(None))
        .all()
    )
    assert len(system) >= 1
    assert all(p.catalog_key for p in system)


def test_import_catalog_creates_system_recipes(db_session):
    report = import_catalog(db_session)
    assert report.recipes_created >= 1
    system = (
        db_session.query(Recipe)
        .filter_by(source="system", market_code="PL")
        .filter(Recipe.user_id.is_(None))
        .all()
    )
    assert len(system) >= 1


def test_import_catalog_is_idempotent(db_session):
    first = import_catalog(db_session)
    second = import_catalog(db_session)
    assert first.products_created >= 1
    assert second.products_created == 0
    assert second.recipes_created == 0
    count = (
        db_session.query(Product)
        .filter_by(source="system")
        .filter(Product.user_id.is_(None))
        .count()
    )
    assert count >= first.products_created


def test_import_catalog_updates_existing_product(db_session):
    import_catalog(db_session, markets=("PL",))
    system = (
        db_session.query(Product)
        .filter_by(source="system", market_code="PL")
        .filter(Product.user_id.is_(None))
        .first()
    )
    assert system is not None
    original_name = system.name
    system.name = "SHOULD BE OVERWRITTEN"
    db_session.commit()

    second = import_catalog(db_session, markets=("PL",))
    db_session.refresh(system)
    assert second.products_updated >= 1
    assert system.name == original_name
