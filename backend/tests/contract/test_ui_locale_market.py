"""Contract tests for ui_locale vs market_code separation."""

from __future__ import annotations

from app.core.security import create_access_token
from app.domain.product_normalize import normalize_product_name
from app.models.product import Product
from app.models.recipe import Recipe
from app.models.user import User

from tests.conftest import create_user


def _product_items(response_json: dict | list) -> list:
    if isinstance(response_json, dict) and "items" in response_json:
        return response_json["items"]
    return response_json


def test_register_sets_ui_locale_and_default_market(client, db_session):
    reg = client.post(
        "/api/auth/register",
        json={"username": "locale1", "password": "secret123", "lang": "en"},
    )
    assert reg.status_code == 201
    user = db_session.query(User).filter_by(username="locale1").first()
    assert user.ui_locale == "en"
    assert user.market_code == "GB"


def test_register_pl_defaults_to_pl_market(client, db_session):
    reg = client.post(
        "/api/auth/register",
        json={"username": "locale2", "password": "secret123", "lang": "pl"},
    )
    assert reg.status_code == 201
    user = db_session.query(User).filter_by(username="locale2").first()
    assert user.ui_locale == "pl"
    assert user.market_code == "PL"


def test_me_returns_ui_locale_and_market_code(client, user, auth_headers):
    res = client.get("/api/auth/me", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["ui_locale"] == "pl"
    assert data["market_code"] == "PL"
    assert data["lang"] == "pl"


def test_change_language_updates_ui_locale_only(client, user, auth_headers, db_session):
    res = client.patch(
        "/api/auth/language",
        headers=auth_headers,
        json={"lang": "en"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["ui_locale"] == "en"
    assert body["lang"] == "en"
    assert body["market_code"] == "PL"

    db_session.refresh(user)
    assert user.ui_locale == "en"
    assert user.market_code == "PL"


def test_change_market_updates_market_only(client, user, auth_headers, db_session, global_catalog):
    before_recipes = db_session.query(Recipe).filter_by(user_id=user.id).count()
    before_products = db_session.query(Product).filter_by(user_id=user.id).count()

    res = client.patch(
        "/api/auth/market",
        headers=auth_headers,
        json={"market_code": "GB"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["market_code"] == "GB"
    assert body["ui_locale"] == "pl"

    db_session.refresh(user)
    assert user.market_code == "GB"
    assert db_session.query(Recipe).filter_by(user_id=user.id).count() == before_recipes
    assert db_session.query(Product).filter_by(user_id=user.id).count() == before_products


def test_change_market_rejects_invalid(client, auth_headers):
    res = client.patch(
        "/api/auth/market",
        headers=auth_headers,
        json={"market_code": "US"},
    )
    assert res.status_code == 400


def test_product_list_shows_all_user_products_regardless_of_market(
    client, db_session, auth_headers, user, global_catalog
):
    user.ui_locale = "en"
    user.market_code = "PL"
    db_session.commit()

    from app.models.product import Product
    from app.models.product_market_price import ProductMarketPrice

    pl_only = Product(
        user_id=user.id,
        source="user",
        user_name="Tylko PL",
        normalized_name=normalize_product_name("Tylko PL"),
        kcal=0,
        protein=0,
        fat=0,
        carbs=0,
    )
    pl_only.market_prices.append(
        ProductMarketPrice(
            market_code="PL",
            amount=1.0,
            currency="PLN",
            package_weight=100,
            unit="g",
            sold_by_weight=False,
        )
    )
    gb_only = Product(
        user_id=user.id,
        source="user",
        user_name="GB only item",
        normalized_name=normalize_product_name("GB only item"),
        kcal=0,
        protein=0,
        fat=0,
        carbs=0,
    )
    gb_only.market_prices.append(
        ProductMarketPrice(
            market_code="GB",
            amount=1.0,
            currency="GBP",
            package_weight=100,
            unit="g",
            sold_by_weight=False,
        )
    )
    db_session.add_all([pl_only, gb_only])
    db_session.commit()
    db_session.refresh(pl_only)
    db_session.refresh(gb_only)

    res = client.get(
        "/api/products/",
        headers=auth_headers,
        params={"limit": 100, "q": "Tylko PL"},
    )
    assert res.status_code == 200
    ids = {p["id"] for p in _product_items(res.json())}
    assert pl_only.id in ids
    # GB-priced product is still visible; search by its name separately
    res2 = client.get(
        "/api/products/",
        headers=auth_headers,
        params={"limit": 100, "q": "GB only"},
    )
    ids2 = {p["id"] for p in _product_items(res2.json())}
    assert gb_only.id in ids2


def test_register_does_not_copy_global_catalog(client, db_session, global_catalog):
    reg = client.post(
        "/api/auth/register",
        json={"username": "noseed2", "password": "secret123", "lang": "pl"},
    )
    assert reg.status_code == 201
    user = db_session.query(User).filter_by(username="noseed2").first()
    assert db_session.query(Product).filter_by(user_id=user.id).count() == 0
    assert db_session.query(Recipe).filter_by(user_id=user.id).count() == 0

    token = reg.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    products = client.get("/api/products/", headers=headers, params={"limit": 5})
    recipes = client.get("/api/recipes/", headers=headers)
    assert products.json()["total"] >= 1
    assert len(recipes.json()) >= 1


def test_login_does_not_seed_recipes(client, db_session, global_catalog):
    create_user(db_session, "loginseed@example.com", lang="pl", username="loginseed")
    user = db_session.query(User).filter_by(username="loginseed").first()
    assert db_session.query(Recipe).filter_by(user_id=user.id).count() == 0
    res = client.post(
        "/api/auth/login",
        json={"username": "loginseed", "password": "test-password"},
    )
    assert res.status_code == 200
    assert db_session.query(Recipe).filter_by(user_id=user.id).count() == 0


def test_me_does_not_seed_recipes(client, db_session, global_catalog):
    user = create_user(db_session, "meseed@example.com", lang="pl", username="meseed")
    assert db_session.query(Recipe).filter_by(user_id=user.id).count() == 0
    token = create_access_token(user.id)
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/auth/me", headers=headers)
    assert res.status_code == 200
    assert db_session.query(Recipe).filter_by(user_id=user.id).count() == 0


def test_change_language_does_not_seed_recipes(client, user, auth_headers, db_session, global_catalog):
    before = db_session.query(Recipe).filter_by(user_id=user.id).count()
    res = client.patch(
        "/api/auth/language",
        headers=auth_headers,
        json={"lang": "en"},
    )
    assert res.status_code == 200
    assert db_session.query(Recipe).filter_by(user_id=user.id).count() == before
