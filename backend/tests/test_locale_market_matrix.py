"""Four-way ui_locale × market_code behavior matrix."""

from __future__ import annotations

from datetime import date

import pytest
from app.core.security import create_access_token
from app.domain.product_normalize import normalize_product_name
from app.models.meal_plan import MealPlan
from app.models.product import Product
from app.models.product_market_price import ProductMarketPrice
from app.models.product_translation import ProductTranslation
from app.models.recipe import Recipe, RecipeIngredient
from app.models.recipe_translation import RecipeTranslation
from app.scripts.import_catalog import import_catalog

from tests.conftest import create_user

MATRIX = [
    ("pl", "PL", "ananas", "PLN"),
    ("pl", "GB", "ananas", "GBP"),
    ("en", "PL", "pineapple", "PLN"),
    ("en", "GB", "pineapple", "GBP"),
]


@pytest.fixture
def catalog(db_session):
    import_catalog(db_session)
    product = db_session.query(Product).filter_by(catalog_key="pineapple").one()
    recipe = db_session.query(Recipe).filter(Recipe.catalog_key.isnot(None)).first()
    return {"product": product, "recipe": recipe}


def _headers(user):
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


def _set_prefs(db_session, user, ui_locale: str, market_code: str):
    user.ui_locale = ui_locale
    user.market_code = market_code
    db_session.commit()


@pytest.mark.parametrize("ui_locale,market_code,expected_name,currency", MATRIX)
def test_system_product_name_and_currency(
    client, db_session, catalog, ui_locale, market_code, expected_name, currency
):
    user = create_user(db_session, f"m-{ui_locale}-{market_code}@x.com", lang=ui_locale, market_code=market_code)
    _set_prefs(db_session, user, ui_locale, market_code)

    res = client.get(
        "/api/products/",
        headers=_headers(user),
        params={"limit": 100, "q": "ananas"},
    )
    assert res.status_code == 200
    match = next(
        (p for p in res.json()["items"] if p.get("catalog_key") == "pineapple"),
        None,
    )
    assert match is not None
    assert match["name"].lower() == expected_name
    assert match["currency"] == currency
    assert match["protein"] == catalog["product"].protein


@pytest.mark.parametrize("ui_locale,market_code,expected_name,currency", MATRIX)
def test_system_recipe_name_stable(
    client, db_session, catalog, ui_locale, market_code, expected_name, currency
):
    user = create_user(db_session, f"r-{ui_locale}-{market_code}@x.com", lang=ui_locale, market_code=market_code)
    _set_prefs(db_session, user, ui_locale, market_code)
    recipe_id = catalog["recipe"].id

    res = client.get(f"/api/recipes/{recipe_id}", headers=_headers(user))
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == recipe_id
    assert isinstance(body["name"], str) and body["name"]
    assert body["total_protein"] >= 0


@pytest.mark.parametrize("ui_locale,market_code,expected_name,currency", MATRIX)
def test_custom_product_visible_with_user_name(
    client, db_session, ui_locale, market_code, expected_name, currency
):
    user = create_user(db_session, f"u-{ui_locale}-{market_code}@x.com", lang=ui_locale, market_code=market_code)
    custom_name = "Moja wlasna rzecz XYZ"
    product = Product(
        user_id=user.id,
        source="user",
        user_name=custom_name,
        normalized_name=normalize_product_name(custom_name),
        kcal=10,
        protein=1,
        fat=1,
        carbs=1,
    )
    product.market_prices.append(
        ProductMarketPrice(
            market_code="PL",
            amount=4.99,
            currency="PLN",
            package_weight=100,
            unit="g",
            sold_by_weight=False,
        )
    )
    db_session.add(product)
    db_session.commit()

    _set_prefs(db_session, user, ui_locale, market_code)
    res = client.get(
        "/api/products/",
        headers=_headers(user),
        params={"q": "XYZ", "limit": 20},
    )
    row = next(p for p in res.json()["items"] if p["id"] == product.id)
    assert row["name"] == custom_name
    if market_code == "PL":
        assert row["currency"] == "PLN"
        assert row["price"] == 4.99
    else:
        assert row["currency"] == "GBP"
        assert row["has_price"] is False


@pytest.mark.parametrize("ui_locale,market_code,expected_name,currency", MATRIX)
def test_meal_plan_recipe_id_stable(
    client, db_session, catalog, ui_locale, market_code, expected_name, currency
):
    user = create_user(db_session, f"mp-{ui_locale}-{market_code}@x.com", lang=ui_locale, market_code=market_code)
    _set_prefs(db_session, user, ui_locale, market_code)
    recipe_id = catalog["recipe"].id
    member = user.household_members[0] if hasattr(user, "household_members") else None
    from app.models.household_member import HouseholdMember

    member = db_session.query(HouseholdMember).filter_by(user_id=user.id, is_primary=True).first()

    meal = MealPlan(
        user_id=user.id,
        member_id=member.id,
        date=date(2026, 6, 1),
        position=1,
        recipe_id=recipe_id,
    )
    db_session.add(meal)
    db_session.commit()

    res = client.get("/api/meal-plan/2026-06-01", headers=_headers(user))
    assert res.status_code == 200
    assert res.json()[0]["recipe_id"] == recipe_id
