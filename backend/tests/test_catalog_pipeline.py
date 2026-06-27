"""Tests for catalog build/import pipeline."""

from __future__ import annotations

import pytest
from app.core.catalog_data import (
    canonical_products_path,
    generated_products_path,
    generated_recipes_path,
    read_generated_items,
)
from app.domain.catalog_seed import expand_products_catalog
from app.models.product import Product
from app.models.recipe import Recipe
from app.models.user import User
from app.scripts.build_catalog import build
from app.scripts.import_catalog import import_catalog

from tests.conftest import create_user


def test_build_catalog_check_passes():
    assert build(check=True) == 0


def test_canonical_has_expected_pl_product_count():
    from app.core.catalog_data import load_json_list

    products = load_json_list(canonical_products_path())
    assert len(products) == 445


def test_generated_pl_product_count():
    _, items = read_generated_items(generated_products_path("PL"))
    assert len(items) == 445


def test_generated_gb_has_recipes():
    _, items = read_generated_items(generated_recipes_path("GB"))
    assert len(items) == 69


def test_generated_envelope_metadata():
    meta, _ = read_generated_items(generated_products_path("PL"))
    assert meta.get("generated") is True
    assert meta.get("do_not_edit") is True
    assert meta.get("market_code") == "PL"
    assert meta.get("canonical_version")


def test_import_catalog_idempotent(db_session):
    first = import_catalog(db_session)
    second = import_catalog(db_session)
    assert first.products_created >= 1
    assert second.products_created == 0
    assert second.recipes_created == 0


def test_import_catalog_unique_system_keys(db_session):
    import_catalog(db_session)
    keys = [
        p.catalog_key
        for p in db_session.query(Product).filter_by(source="system").all()
        if p.catalog_key
    ]
    assert len(keys) == len(set(keys))


def test_expand_products_uses_market_not_ui():
    from app.core.catalog_data import load_json_list

    catalog = load_json_list(canonical_products_path())
    pl = expand_products_catalog(catalog, "pl")
    en = expand_products_catalog(catalog, "en")
    assert pl[0]["name"] != en[0]["name"] or len(pl) != len(en)


def test_ui_locale_en_market_pl_shows_same_catalog_count(client, db_session, global_catalog):
    from app.core.security import create_access_token

    user = create_user(db_session, "en-ui-pl@example.com", lang="en", market_code="PL")
    headers = {"Authorization": f"Bearer {create_access_token(user.id)}"}
    res = client.get("/api/products/", headers=headers, params={"limit": 5})
    assert res.status_code == 200
    assert res.json()["total"] >= 400


def test_ui_locale_pl_market_gb_shows_same_catalog_count(client, db_session, global_catalog):
    user = create_user(db_session, "pl-ui-gb@example.com", lang="pl", market_code="GB")
    from app.core.security import create_access_token

    headers = {"Authorization": f"Bearer {create_access_token(user.id)}"}
    res = client.get("/api/products/", headers=headers, params={"limit": 5})
    assert res.status_code == 200
    total = res.json()["total"]
    assert total >= 400


def test_private_product_not_in_global_catalog(client, auth_headers, product, db_session, global_catalog):
    other = create_user(db_session, "other@example.com", lang="pl")
    from app.core.security import create_access_token

    res = client.get(
        "/api/products/",
        headers={"Authorization": f"Bearer {create_access_token(other.id)}"},
        params={"q": "Jogurt", "limit": 50},
    )
    ids = {p["id"] for p in res.json()["items"]}
    assert product.id not in ids


def test_import_catalog_transaction_rolls_back_on_error(db_session, monkeypatch):
    from app.scripts import import_catalog as import_mod

    calls = {"commit": 0, "rollback": 0}
    original_commit = db_session.commit
    original_rollback = db_session.rollback

    def commit():
        calls["commit"] += 1
        if calls["commit"] == 1:
            raise RuntimeError("simulated failure")
        original_commit()

    def rollback():
        calls["rollback"] += 1
        original_rollback()

    monkeypatch.setattr(db_session, "commit", commit)
    monkeypatch.setattr(db_session, "rollback", rollback)

    with pytest.raises(RuntimeError):
        import_mod.import_catalog(db_session)
    assert calls["rollback"] == 1


def test_register_bootstraps_global_catalog_on_empty_db(client, db_session):
    assert db_session.query(Product).filter_by(source="system").count() == 0
    reg = client.post(
        "/api/auth/register",
        json={"username": "bootstrap1", "password": "secret123", "lang": "pl"},
    )
    assert reg.status_code == 201
    assert db_session.query(Product).filter_by(source="system").count() >= 1
    user = db_session.query(User).filter_by(username="bootstrap1").first()
    assert db_session.query(Product).filter_by(user_id=user.id).count() == 0


def test_system_recipe_visible_without_user_copy(client, db_session, global_catalog):
    user = create_user(db_session, "recipes-global@example.com", lang="pl")
    assert db_session.query(Recipe).filter_by(user_id=user.id).count() == 0
    from app.core.security import create_access_token

    res = client.get(
        "/api/recipes/",
        headers={"Authorization": f"Bearer {create_access_token(user.id)}"},
    )
    assert res.status_code == 200
    assert len(res.json()) >= 1
