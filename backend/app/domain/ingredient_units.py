"""Resolve recipe ingredient display units and costs."""

from __future__ import annotations

from app.domain.product_normalize import normalize_product_name
from app.models.recipe import RecipeIngredient
from app.services.catalog_resolver import resolve_product

PIECE_WEIGHTS_G: dict[str, float] = {
    "awokado": 200,
    "avocado": 200,
    "banan": 120,
    "banana": 120,
    "jablko": 150,
    "apple": 150,
    "jajko": 60,
    "jajka": 60,
    "egg": 60,
    "eggs": 60,
    "czosnek": 5,
    "garlic": 5,
    "cebula": 100,
    "onion": 100,
    "pomidor": 120,
    "tomato": 120,
    "papryka": 150,
    "pepper": 150,
    "ogorek": 250,
    "cucumber": 250,
    "cytryna": 80,
    "lemon": 80,
    "limonka": 70,
    "lime": 70,
    "mango": 300,
    "ananas": 900,
    "pineapple": 900,
    "ziemniak": 150,
    "potato": 150,
    "batat": 200,
    "sweet potato": 200,
    "marchew": 80,
    "carrot": 80,
    "pierś z kurczaka": 180,
    "chicken breast": 180,
    "losos": 150,
    "salmon": 150,
    "krewetki": 15,
    "shrimp": 15,
}


def piece_weight_grams(product_name: str | None) -> float:
    if not product_name:
        return 100.0
    key = normalize_product_name(product_name)
    if key in PIECE_WEIGHTS_G:
        return PIECE_WEIGHTS_G[key]
    for token in key.split():
        if token in PIECE_WEIGHTS_G:
            return PIECE_WEIGHTS_G[token]
    return 100.0


def resolve_ingredient_unit(
    ingredient: RecipeIngredient,
    *,
    locale: str = "pl",
    market_code: str = "PL",
) -> str:
    product = ingredient.product
    if not product:
        return "g"

    view = resolve_product(product, locale=locale, market_code=market_code)
    product_unit = (view.unit or "g").lower()
    if product_unit != "szt":
        return view.unit or "g"

    weight = float(ingredient.weight)
    piece_g = piece_weight_grams(view.name)

    if weight == int(weight) and 1 <= weight <= 12:
        if weight <= max(3.0, piece_g / 25.0):
            return "szt"

    return "g"


def ingredient_cost(
    ingredient: RecipeIngredient,
    *,
    locale: str = "pl",
    market_code: str = "PL",
) -> float:
    product = ingredient.product
    if not product:
        return 0.0

    view = resolve_product(product, locale=locale, market_code=market_code)
    if not view.has_price or view.price is None:
        return 0.0

    price = float(view.price)
    weight = float(ingredient.weight)
    display_unit = resolve_ingredient_unit(ingredient, locale=locale, market_code=market_code)
    product_unit = (view.unit or "g").lower()

    if display_unit == "szt":
        return round(weight * price, 2)

    if product_unit == "szt":
        piece_g = piece_weight_grams(view.name)
        if piece_g > 0:
            return round((weight / piece_g) * price, 2)
        return round(weight * price, 2)

    return round((weight / 100.0) * price, 2)


def ingredient_summary_quantity(
    ingredient: RecipeIngredient,
    *,
    locale: str = "pl",
    market_code: str = "PL",
) -> float:
    """Amount in the product catalog unit for meal-plan expense totals."""
    product = ingredient.product
    if not product:
        return float(ingredient.weight)

    view = resolve_product(product, locale=locale, market_code=market_code)
    product_unit = (view.unit or "g").lower()
    weight = float(ingredient.weight)

    if product_unit != "szt":
        return weight

    display_unit = resolve_ingredient_unit(
        ingredient, locale=locale, market_code=market_code
    )
    if display_unit == "szt":
        return weight

    piece_g = piece_weight_grams(view.name)
    if piece_g > 0:
        return weight / piece_g
    return weight
