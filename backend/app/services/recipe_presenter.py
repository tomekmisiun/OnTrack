from app.models.recipe import Recipe, RecipeIngredient


def _ingredient_cost(ingredient: RecipeIngredient) -> float:
    product = ingredient.product
    if not product:
        return 0.0
    price = product.price or 0
    unit = product.unit or "g"
    if unit == "szt":
        return round(ingredient.weight * price, 2)
    return round((ingredient.weight / 100) * price, 2)


def ingredient_to_dict(ingredient: RecipeIngredient) -> dict:
    product = ingredient.product
    return {
        "id": ingredient.id,
        "product_id": ingredient.product_id,
        "product_name": product.name if product else "",
        "package_weight": product.package_weight if product else None,
        "unit": (product.unit or "g") if product else "g",
        "kcal": product.kcal if product else None,
        "protein": product.protein if product else None,
        "fat": product.fat if product else None,
        "carbs": product.carbs if product else None,
        "weight": ingredient.weight,
        "cost": _ingredient_cost(ingredient),
    }


def _total_weight(recipe: Recipe) -> float:
    return sum(
        i.weight for i in recipe.ingredients if i.product and i.product.unit != "szt"
    )


def _calc_macros(recipe: Recipe) -> tuple[int, float, float, float]:
    if recipe.kcal_100g is not None:
        total = _total_weight(recipe)
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
        if not p or p.unit == "szt":
            continue
        factor = ing.weight / 100.0
        kcal += (p.kcal or 0) * factor
        protein += (p.protein or 0) * factor
        fat += (p.fat or 0) * factor
        carbs += (p.carbs or 0) * factor
    return round(kcal), round(protein, 1), round(fat, 1), round(carbs, 1)


def _quick_cost(recipe: Recipe) -> float:
    return round(sum(_ingredient_cost(i) for i in recipe.ingredients), 2)


def _total_cost(recipe: Recipe) -> float:
    return round(sum(_ingredient_cost(i) for i in recipe.ingredients), 2)


def recipe_to_summary(recipe: Recipe) -> dict:
    kcal, protein, fat, carbs = _calc_macros(recipe)
    return {
        "id": recipe.id,
        "name": recipe.name,
        "notes": recipe.notes,
        "is_favorite": bool(recipe.is_favorite),
        "ingredients": [],
        "total_cost": _quick_cost(recipe),
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
        "lang": recipe.lang,
    }


def recipe_to_dict(recipe: Recipe) -> dict:
    kcal, protein, fat, carbs = _calc_macros(recipe)
    return {
        "id": recipe.id,
        "name": recipe.name,
        "notes": recipe.notes,
        "is_favorite": bool(recipe.is_favorite),
        "ingredients": [ingredient_to_dict(i) for i in recipe.ingredients],
        "total_cost": _total_cost(recipe),
        "total_kcal": kcal,
        "total_protein": protein,
        "total_fat": fat,
        "total_carbs": carbs,
        "image_url": recipe.image_url,
        "source_url": recipe.source_url,
        "category": recipe.category,
        "servings": recipe.servings,
        "lang": recipe.lang,
    }
