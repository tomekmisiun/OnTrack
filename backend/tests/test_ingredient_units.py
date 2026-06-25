"""Tests for recipe ingredient unit resolution."""

from __future__ import annotations

from types import SimpleNamespace

from app.domain.ingredient_units import ingredient_cost, resolve_ingredient_unit
from app.models.recipe import RecipeIngredient


def _ingredient(
    *,
    weight: float,
    product_unit: str = "g",
    name: str = "test",
    price: float = 10.0,
) -> RecipeIngredient:
    product = SimpleNamespace(
        unit=product_unit,
        name=name,
        normalized_name=name,
        price=price,
        package_weight=1,
    )
    ing = RecipeIngredient(recipe_id=1, product_id=1, weight=weight)
    ing.product = product  # type: ignore[attr-defined]
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
    # 50g of 200g piece → 0.25 * 8.0
    assert ingredient_cost(ing) == 2.0


def test_piece_count_cost():
    ing = _ingredient(weight=2, product_unit="szt", name="jajka", price=1.0)
    assert ingredient_cost(ing) == 2.0
