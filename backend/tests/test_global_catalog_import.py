"""Tests for global catalog import from canonical JSON."""

from __future__ import annotations

from app.models.product import Product
from app.models.recipe import Recipe
from app.scripts.import_catalog import import_catalog


def test_import_catalog_creates_system_products(db_session):
    report = import_catalog(db_session)
    assert report.products_created >= 1
    system = (
        db_session.query(Product)
        .filter_by(source="system")
        .filter(Product.user_id.is_(None))
        .all()
    )
    assert len(system) >= 1
    assert all(p.catalog_key for p in system)


def test_import_catalog_creates_translations_and_prices(db_session):
    import_catalog(db_session)
    product = (
        db_session.query(Product)
        .filter_by(source="system")
        .filter(Product.user_id.is_(None))
        .first()
    )
    assert product is not None
    locales = {t.locale for t in product.translations}
    markets = {p.market_code for p in product.market_prices}
    assert "pl" in locales
    assert "en" in locales
    assert "PL" in markets
    assert "GB" in markets


def test_import_catalog_creates_system_recipes(db_session):
    report = import_catalog(db_session)
    assert report.recipes_created >= 1
    system = (
        db_session.query(Recipe)
        .filter_by(source="system")
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


def test_import_catalog_one_product_per_catalog_key(db_session):
    import_catalog(db_session)
    keys = [
        p.catalog_key
        for p in db_session.query(Product).filter_by(source="system").all()
        if p.catalog_key
    ]
    assert len(keys) == len(set(keys))


def test_import_catalog_updates_existing_translation(db_session):
    import_catalog(db_session)
    product = (
        db_session.query(Product)
        .filter_by(source="system")
        .filter(Product.user_id.is_(None))
        .first()
    )
    assert product is not None
    pl_row = next(t for t in product.translations if t.locale == "pl")
    original = pl_row.name
    pl_row.name = "SHOULD BE OVERWRITTEN"
    db_session.commit()

    second = import_catalog(db_session)
    db_session.refresh(pl_row)
    assert second.products_updated >= 0
    assert pl_row.name == original
