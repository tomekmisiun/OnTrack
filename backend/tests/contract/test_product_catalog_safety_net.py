"""Safety-net tests for product catalog isolation, seed behavior, and migration guards."""

from __future__ import annotations

from app.domain.product_normalize import normalize_product_name
from app.models.product import Product
from app.models.recipe import Recipe
from app.models.user import User
from app.services.catalog_seed_service import ensure_user_seeded
from app.worker.queue import drain_testing_jobs, reset_testing_jobs

from tests.conftest import create_user


def _product_items(response_json: dict | list) -> list:
    if isinstance(response_json, dict) and "items" in response_json:
        return response_json["items"]
    return response_json


# --- Cross-user isolation (authorization) ---


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


# --- Registration: no per-user product copy (global catalog) ---


def test_register_does_not_copy_seed_products_per_user(client, db_session):
    reg = client.post(
        "/api/auth/register",
        json={"username": "noseed1", "password": "secret123", "lang": "pl"},
    )
    assert reg.status_code == 201
    user = db_session.query(User).filter_by(username="noseed1").first()
    assert user is not None
    private_count = db_session.query(Product).filter_by(user_id=user.id, lang="pl").count()
    assert private_count == 0


def test_register_sees_global_catalog_via_api(client, db_session):
    reg = client.post(
        "/api/auth/register",
        json={"username": "globalview1", "password": "secret123", "lang": "pl"},
    )
    assert reg.status_code == 201
    token = reg.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/products/", headers=headers, params={"limit": 100})
    assert res.status_code == 200
    items = _product_items(res.json())
    assert any(p["is_system"] for p in items)
    assert items  # global catalog visible without private copies


# --- Seed idempotency ---


def test_ensure_user_seeded_twice_does_not_duplicate_recipes(db_session):
    user = create_user(db_session, "idempotent@example.com", lang="pl")
    ensure_user_seeded(db_session, user.id, "pl")
    after_first = db_session.query(Recipe).filter_by(user_id=user.id, lang="pl").count()
    assert after_first >= 1
    assert db_session.query(Product).filter_by(user_id=user.id, lang="pl").count() == 0

    ensure_user_seeded(db_session, user.id, "pl")
    after_second = db_session.query(Recipe).filter_by(user_id=user.id, lang="pl").count()
    assert after_second == after_first


# --- Product list (current contract: no pagination) ---


def test_product_list_excludes_other_users_products(
    client, auth_headers, other_auth_headers, product
):
    res = client.get("/api/products/", headers=other_auth_headers)
    assert res.status_code == 200
    assert all(p["id"] != product.id for p in _product_items(res.json()))


def test_product_list_filters_by_user_language(client, auth_headers, user, db_session):
    foreign_lang = Product(
        user_id=user.id,
        source="user",
        normalized_name=normalize_product_name("English only item"),
        name="English only item",
        package_weight=100,
        price=1.0,
        unit="g",
        lang="en",
    )
    db_session.add(foreign_lang)
    db_session.commit()
    db_session.refresh(foreign_lang)

    res = client.get("/api/products/", headers=auth_headers)
    assert res.status_code == 200
    ids = {p["id"] for p in _product_items(res.json())}
    assert foreign_lang.id not in ids


def test_product_list_supports_pagination(client, auth_headers, product):
    """CAT-004: list returns paginated envelope with limit/offset/total."""
    res = client.get("/api/products/", headers=auth_headers, params={"limit": 1, "offset": 0})
    assert res.status_code == 200
    body = res.json()
    assert isinstance(body, dict)
    assert "items" in body
    assert "total" in body
    assert "limit" in body
    assert "offset" in body
    assert isinstance(body["items"], list)
    assert body["limit"] == 1
    assert body["total"] >= 1


# --- Worker / registration (worker not required; redundant enqueue) ---


def test_register_does_not_enqueue_catalog_seed_job(client, db_session):
    """Recipe seed is synchronous; no background catalog_seed job is enqueued."""
    reset_testing_jobs()
    reg = client.post(
        "/api/auth/register",
        json={"username": "noworker1", "password": "secret123", "lang": "pl"},
    )
    assert reg.status_code == 201
    user = db_session.query(User).filter_by(username="noworker1").first()
    assert db_session.query(Product).filter_by(user_id=user.id, lang="pl").count() == 0
    assert db_session.query(Recipe).filter_by(user_id=user.id, lang="pl").count() >= 1
    assert drain_testing_jobs() == []


def test_register_recipe_seed_is_idempotent(client, db_session):
    """Repeated ensure_user_seeded must not duplicate demo recipes."""
    user = create_user(db_session, "redundant1@example.com", lang="pl")
    ensure_user_seeded(db_session, user.id, "pl")
    before = db_session.query(Recipe).filter_by(user_id=user.id, lang="pl").count()
    assert before >= 1
    ensure_user_seeded(db_session, user.id, "pl")
    after = db_session.query(Recipe).filter_by(user_id=user.id, lang="pl").count()
    assert after == before
