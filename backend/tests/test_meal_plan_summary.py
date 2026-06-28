"""Meal plan summary aggregation tests."""

from __future__ import annotations

from datetime import date

from app.domain.product_normalize import normalize_product_name
from app.models.product import Product
from app.models.product_market_price import ProductMarketPrice
from app.models.recipe import Recipe, RecipeIngredient
from app.services import meal_plan_service


def _szt_product(
    db_session,
    user_id: int,
    *,
    name: str,
    price: float,
    package_weight: float = 1.0,
) -> Product:
    product = Product(
        user_id=user_id,
        source="user",
        user_name=name,
        normalized_name=normalize_product_name(name),
        kcal=100,
        protein=1,
        fat=1,
        carbs=1,
    )
    product.market_prices.append(
        ProductMarketPrice(
            market_code="PL",
            amount=price,
            currency="PLN",
            package_weight=package_weight,
            unit="szt",
            sold_by_weight=False,
        )
    )
    db_session.add(product)
    db_session.flush()
    return product


def test_summary_converts_gram_weights_for_szt_products(
    db_session, user, member, product
):
    """Avocado egg salad stores 200g avocado + 150g eggs, not 200/150 pieces."""
    avocado = _szt_product(db_session, user.id, name="awokado", price=6.99)
    eggs = _szt_product(
        db_session, user.id, name="jajka", price=1.599, package_weight=10.0
    )
    recipe = Recipe(
        user_name="Sałatka testowa",
        user_id=user.id,
        source="user",
        category="lunch",
        servings=1,
    )
    db_session.add(recipe)
    db_session.flush()
    db_session.add_all(
        [
            RecipeIngredient(recipe_id=recipe.id, product_id=avocado.id, weight=200),
            RecipeIngredient(recipe_id=recipe.id, product_id=eggs.id, weight=150),
        ]
    )
    db_session.commit()

    meal_plan_service.add_meal(
        db_session,
        user.id,
        day=date(2026, 6, 15),
        position=1,
        recipe_id=recipe.id,
        member_id=member.id,
    )

    summary = meal_plan_service.get_summary(
        db_session,
        user.id,
        date(2026, 6, 15),
        date(2026, 6, 15),
        member_id=member.id,
    )
    by_name = {item["product_name"]: item for item in summary["items"]}

    assert by_name["awokado"]["total_weight"] == 1.0
    assert by_name["awokado"]["packages_rounded"] == 1
    assert by_name["jajka"]["total_weight"] == 2.5
    assert by_name["jajka"]["packages_rounded"] == 1
