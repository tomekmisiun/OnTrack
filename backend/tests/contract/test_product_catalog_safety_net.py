"""Safety-net tests for product catalog isolation, seed behavior, and migration guards."""

from __future__ import annotations

from app.domain.product_normalize import normalize_product_name
from app.models.product import Product
from app.models.recipe import Recipe
from app.models.user import User
from app.scripts.import_catalog import import_catalog


def _product_items(response_json: dict | list) -> list:
    if isinstance(response_json, dict) and "items" in response_json:
        return response_json["items"]
    return response_json


def test_user_a_cannot_see_user_b_private_product(
    client, auth_headers, other_auth_headers, product
):
    res = client.get("/api/products/", headers=other_auth_headers)
    assert res.status_code == 200
    ids = {p["id"] for p in _product_items(res.json())}
    assert product.id not in ids


def test_user_a_cannot_update_user_b_product(client, auth_headers, other_auth_headers, product):
    res = client.put(
        f"/api/products/{product.id}",
        headers=other_auth_headers,
        json={"price": 9.99},
    )
    assert res.status_code == 404


def test_user_a_cannot_delete_user_b_product(client, auth_headers, other_auth_headers, product):
    res = client.delete(f"/api/products/{product.id}", headers=other_auth_headers)
    assert res.status_code == 404


def test_user_a_cannot_use_user_b_product_in_recipe(client, other_auth_headers, product):
    res = client.post(
        "/api/recipes/",
        headers=other_auth_headers,
        json={
            "name": "Cudzy przepis",
            "category": "lunch",
            "servings": 2,
            "ingredients": [{"product_id": product.id, "weight": 100}],
        },
    )
    assert res.status_code == 404
    assert "not found" in res.json()["error"].lower()


def test_register_does_not_copy_seed_products_per_user(client, db_session, global_catalog):
    reg = client.post(
        "/api/auth/register",
        json={"email": "noseed1@example.com", "password": "secret123", "lang": "pl"},
    )
    assert reg.status_code == 201
    user = db_session.query(User).filter(User.email.ilike("noseed1@example.com")).first()
    assert user is not None
    private_count = db_session.query(Product).filter_by(user_id=user.id).count()
    assert private_count == 0


def test_register_sees_global_catalog_via_api(client, db_session, global_catalog):
    reg = client.post(
        "/api/auth/register",
        json={"email": "globalview1@example.com", "password": "secret123", "lang": "pl"},
    )
    assert reg.status_code == 201
    token = reg.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/products/", headers=headers, params={"limit": 100})
    assert res.status_code == 200
    items = _product_items(res.json())
    assert any(p["is_system"] for p in items)
    assert items


def test_import_catalog_idempotent(db_session):
    import_catalog(db_session)
    system_count = (
        db_session.query(Product)
        .filter(Product.user_id.is_(None), Product.source == "system")
        .count()
    )
    import_catalog(db_session)
    assert (
        db_session.query(Product)
        .filter(Product.user_id.is_(None), Product.source == "system")
        .count()
        == system_count
    )


def test_product_list_excludes_other_users_products(
    client, auth_headers, other_auth_headers, product
):
    res = client.get("/api/products/", headers=other_auth_headers)
    assert res.status_code == 200
    assert all(p["id"] != product.id for p in _product_items(res.json()))


def test_product_list_includes_user_products_from_any_market(
    client, auth_headers, user, db_session, global_catalog
):
    from app.models.product_market_price import ProductMarketPrice

    foreign = Product(
        user_id=user.id,
        source="user",
        user_name="English only item",
        normalized_name=normalize_product_name("English only item"),
        kcal=0,
        protein=0,
        fat=0,
        carbs=0,
    )
    foreign.market_prices.append(
        ProductMarketPrice(
            market_code="GB",
            amount=1.0,
            currency="GBP",
            package_weight=100,
            unit="g",
            sold_by_weight=False,
        )
    )
    db_session.add(foreign)
    db_session.commit()
    db_session.refresh(foreign)

    res = client.get("/api/products/", headers=auth_headers, params={"q": "English only"})
    assert res.status_code == 200
    ids = {p["id"] for p in _product_items(res.json())}
    assert foreign.id in ids


def test_product_list_supports_pagination(client, auth_headers, product, global_catalog):
    res = client.get("/api/products/", headers=auth_headers, params={"limit": 1, "offset": 0})
    assert res.status_code == 200
    body = res.json()
    assert isinstance(body, dict)
    assert "items" in body
    assert "total" in body
    assert body["limit"] == 1
    assert body["total"] >= 1


def test_register_does_not_enqueue_catalog_seed_job(client, db_session, global_catalog):
    reg = client.post(
        "/api/auth/register",
        json={"email": "noworker1@example.com", "password": "secret123", "lang": "pl"},
    )
    assert reg.status_code == 201
    user = db_session.query(User).filter(User.email.ilike("noworker1@example.com")).first()
    assert db_session.query(Product).filter_by(user_id=user.id).count() == 0
    assert db_session.query(Recipe).filter_by(user_id=user.id).count() == 0


def test_new_user_sees_global_recipes_without_private_copies(client, db_session, global_catalog):
    reg = client.post(
        "/api/auth/register",
        json={"email": "recipes1@example.com", "password": "secret123", "lang": "pl"},
    )
    assert reg.status_code == 201
    user = db_session.query(User).filter(User.email.ilike("recipes1@example.com")).first()
    assert db_session.query(Recipe).filter_by(user_id=user.id).count() == 0
    token = reg.json()["token"]
    res = client.get("/api/recipes/", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert len(res.json()) >= 1
