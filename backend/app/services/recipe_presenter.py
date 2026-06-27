from __future__ import annotations

from app.domain.ingredient_units import ingredient_cost, resolve_ingredient_unit
from app.models.recipe import Recipe, RecipeIngredient
from app.services.catalog_resolver import ResolvedProduct, resolve_product, resolve_recipe


def ingredient_to_dict(
    ingredient: RecipeIngredient,
    *,
    locale: str,
    market_code: str,
) -> dict:
    product = ingredient.product
    view: ResolvedProduct | None = None
    if product:
        view = resolve_product(product, locale=locale, market_code=market_code)
    display_unit = resolve_ingredient_unit(ingredient, market_code=market_code, locale=locale)
    return {
        "id": ingredient.id,
        "product_id": ingredient.product_id,
        "product_name": view.name if view else "",
        "package_weight": view.package_weight if view else None,
        "unit": display_unit,
        "kcal": product.kcal if product else None,
        "protein": product.protein if product else None,
        "fat": product.fat if product else None,
        "carbs": product.carbs if product else None,
        "weight": ingredient.weight,
        "cost": ingredient_cost(ingredient, locale=locale, market_code=market_code),
        "currency": view.currency if view else None,
        "has_price": view.has_price if view else False,
    }


def _total_weight(recipe: Recipe, *, locale: str, market_code: str) -> float:
    return sum(
        i.weight
        for i in recipe.ingredients
        if resolve_ingredient_unit(i, locale=locale, market_code=market_code) != "szt"
    )


def _calc_macros(recipe: Recipe, *, locale: str, market_code: str) -> tuple[int, float, float, float]:
    if recipe.kcal_100g is not None:
        total = _total_weight(recipe, locale=locale, market_code=market_code)
        factor = total / 100.0
        return (
            round(recipe.kcal_100g * factor),
            round((recipe.protein_100g or 0) * factor, 1),
            round((recipe.fat_100g or 0) * factor, 1),
            round((recipe.carbs_100g or 0) * factor, 1),
        )

    kcal = protein = fat = carbs = 0.0
    for ing in recipe.ingredients:
        p = ing.product
        if not p or resolve_ingredient_unit(ing, locale=locale, market_code=market_code) == "szt":
            continue
        factor = ing.weight / 100.0
        kcal += (p.kcal or 0) * factor
        protein += (p.protein or 0) * factor
        fat += (p.fat or 0) * factor
        carbs += (p.carbs or 0) * factor
    return round(kcal), round(protein, 1), round(fat, 1), round(carbs, 1)


def _total_cost(recipe: Recipe, *, locale: str, market_code: str) -> float:
    return round(
        sum(ingredient_cost(i, locale=locale, market_code=market_code) for i in recipe.ingredients),
        2,
    )


def _resolve_favorite(recipe: Recipe, is_favorite: bool | None = None) -> bool:
    if is_favorite is not None:
        return is_favorite
    return bool(recipe.is_favorite)


def recipe_to_summary(
    recipe: Recipe,
    *,
    locale: str,
    market_code: str,
    is_favorite: bool | None = None,
) -> dict:
    resolved = resolve_recipe(recipe, locale=locale)
    kcal, protein, fat, carbs = _calc_macros(recipe, locale=locale, market_code=market_code)
    return {
        "id": recipe.id,
        "catalog_key": recipe.catalog_key,
        "name": resolved.name,
        "notes": resolved.notes,
        "is_favorite": _resolve_favorite(recipe, is_favorite),
        "ingredients": [],
        "total_cost": _total_cost(recipe, locale=locale, market_code=market_code),
        "total_kcal": kcal,
        "total_protein": protein,
        "total_fat": fat,
        "total_carbs": carbs,
        "kcal_100g": recipe.kcal_100g,
        "protein_100g": recipe.protein_100g,
        "fat_100g": recipe.fat_100g,
        "carbs_100g": recipe.carbs_100g,
        "image_url": recipe.image_url,
        "source_url": recipe.source_url,
        "category": recipe.category,
        "servings": recipe.servings,
    }


def recipe_to_dict(
    recipe: Recipe,
    *,
    locale: str,
    market_code: str,
    is_favorite: bool | None = None,
) -> dict:
    resolved = resolve_recipe(recipe, locale=locale)
    kcal, protein, fat, carbs = _calc_macros(recipe, locale=locale, market_code=market_code)
    return {
        "id": recipe.id,
        "catalog_key": recipe.catalog_key,
        "name": resolved.name,
        "notes": resolved.notes,
        "is_favorite": _resolve_favorite(recipe, is_favorite),
        "ingredients": [
            ingredient_to_dict(i, locale=locale, market_code=market_code)
            for i in recipe.ingredients
        ],
        "total_cost": _total_cost(recipe, locale=locale, market_code=market_code),
        "total_kcal": kcal,
        "total_protein": protein,
        "total_fat": fat,
        "total_carbs": carbs,
        "image_url": recipe.image_url,
        "source_url": recipe.source_url,
        "category": recipe.category,
        "servings": recipe.servings,
    }
