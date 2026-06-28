"""Tests for recipe ingredient unit resolution."""

from __future__ import annotations

from app.domain.ingredient_units import (
    ingredient_cost,
    ingredient_summary_quantity,
    resolve_ingredient_unit,
)
from app.models.product import Product
from app.models.product_market_price import ProductMarketPrice
from app.models.recipe import RecipeIngredient


def _ingredient(
    *,
    weight: float,
    product_unit: str = "g",
    name: str = "test",
    price: float = 10.0,
) -> RecipeIngredient:
    product = Product(
        user_id=1,
        source="user",
        user_name=name,
        normalized_name=name,
        kcal=0,
        protein=0,
        fat=0,
        carbs=0,
    )
    product.market_prices.append(
        ProductMarketPrice(
            market_code="PL",
            amount=price,
            currency="PLN",
            package_weight=1,
            unit=product_unit,
            sold_by_weight=False,
        )
    )
    ing = RecipeIngredient(recipe_id=1, product_id=1, weight=weight)
    ing.product = product
    return ing


def test_avocado_grams_not_pieces():
    ing = _ingredient(weight=50, product_unit="szt", name="awokado", price=6.99)
    assert resolve_ingredient_unit(ing) == "g"


def test_avocado_one_piece():
    ing = _ingredient(weight=1, product_unit="szt", name="awokado", price=6.99)
    assert resolve_ingredient_unit(ing) == "szt"


def test_eggs_as_count():
    ing = _ingredient(weight=2, product_unit="szt", name="jajka", price=1.2)
    assert resolve_ingredient_unit(ing) == "szt"


def test_eggs_as_grams():
    ing = _ingredient(weight=120, product_unit="szt", name="jajka", price=1.2)
    assert resolve_ingredient_unit(ing) == "g"


def test_gram_product_unchanged():
    ing = _ingredient(weight=200, product_unit="g", name="mąka pszenna")
    assert resolve_ingredient_unit(ing) == "g"


def test_avocado_cost_uses_fraction_of_piece():
    ing = _ingredient(weight=50, product_unit="szt", name="awokado", price=8.0)
    assert ingredient_cost(ing) == 2.0


def test_piece_count_cost():
    ing = _ingredient(weight=2, product_unit="szt", name="jajka", price=1.0)
    assert ingredient_cost(ing) == 2.0


def test_summary_quantity_avocado_grams_to_pieces():
    ing = _ingredient(weight=200, product_unit="szt", name="awokado", price=6.99)
    assert ingredient_summary_quantity(ing) == 1.0


def test_summary_quantity_eggs_grams_to_pieces():
    ing = _ingredient(weight=150, product_unit="szt", name="jajka", price=1.599)
    assert ingredient_summary_quantity(ing) == 2.5


def test_summary_quantity_eggs_as_count():
    ing = _ingredient(weight=2, product_unit="szt", name="jajka", price=1.599)
    assert ingredient_summary_quantity(ing) == 2.0


def test_summary_quantity_gram_product_unchanged():
    ing = _ingredient(weight=200, product_unit="g", name="mąka pszenna")
    assert ingredient_summary_quantity(ing) == 200.0
