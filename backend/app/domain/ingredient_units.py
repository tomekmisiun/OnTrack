"""Resolve recipe ingredient display units and costs.

RecipeIngredient.weight is stored in grams (or as a small piece count).
Product.unit reflects how the item is sold (g, ml, szt). The presenter must
not label 50 g of avocado as "50 szt" when the matched product is per-piece.
"""

from __future__ import annotations

from app.domain.product_normalize import normalize_product_name
from app.models.recipe import RecipeIngredient

# Average piece weight (g) — aligned with scraper/pipeline/import_to_db.py
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


def resolve_ingredient_unit(ingredient: RecipeIngredient) -> str:
    product = ingredient.product
    if not product:
        return "g"

    product_unit = (product.unit or "g").lower()
    if product_unit != "szt":
        return product.unit or "g"

    weight = float(ingredient.weight)
    piece_g = piece_weight_grams(product.normalized_name or product.name)

    # Small whole numbers usually mean piece count (2 eggs, 1 avocado).
    if weight == int(weight) and 1 <= weight <= 12:
        if weight <= max(3.0, piece_g / 25.0):
            return "szt"

    return "g"


def ingredient_cost(ingredient: RecipeIngredient) -> float:
    product = ingredient.product
    if not product:
        return 0.0

    price = float(product.price or 0)
    weight = float(ingredient.weight)
    display_unit = resolve_ingredient_unit(ingredient)
    product_unit = (product.unit or "g").lower()

    if display_unit == "szt":
        return round(weight * price, 2)

    if product_unit == "szt":
        piece_g = piece_weight_grams(product.normalized_name or product.name)
        if piece_g > 0:
            return round((weight / piece_g) * price, 2)
        return round(weight * price, 2)

    return round((weight / 100.0) * price, 2)
