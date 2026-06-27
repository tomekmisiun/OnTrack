from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, joinedload

from app.models.meal_plan import MealPlan
from app.models.product import Product
from app.models.recipe import Recipe, RecipeIngredient
from app.models.user_recipe_favorite import UserRecipeFavorite
from app.services.product_service import resolve_visible_product
from app.services.recipe_image_service import resolve_recipe_image
from app.services.recipe_presenter import recipe_to_dict, recipe_to_summary
from app.services.user_preferences import market_code_for_user, ui_locale_for_user


class RecipeServiceError(Exception):
    def __init__(self, message: str, status_code: int):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def _recipe_load_options():
    return (
        joinedload(Recipe.translations),
        joinedload(Recipe.ingredients)
        .joinedload(RecipeIngredient.product)
        .joinedload(Product.translations),
        joinedload(Recipe.ingredients)
        .joinedload(RecipeIngredient.product)
        .joinedload(Product.market_prices),
    )


def _favorite_recipe_ids(session: Session, user_id: int) -> set[int]:
    return {
        row[0]
        for row in session.query(UserRecipeFavorite.recipe_id)
        .filter_by(user_id=user_id)
        .all()
    }


def _is_favorite(session: Session, user_id: int, recipe: Recipe, favorites: set[int]) -> bool:
    if recipe.source == "system" and recipe.user_id is None:
        return recipe.id in favorites
    return bool(recipe.is_favorite)


def _visible_recipes_query(session: Session, user_id: int):
    return session.query(Recipe).options(*_recipe_load_options()).filter(
        or_(
            and_(Recipe.source == "system", Recipe.user_id.is_(None)),
            and_(Recipe.user_id == user_id, Recipe.source != "system"),
        )
    )


def _load_recipe(session: Session, user_id: int, recipe_id: int) -> Recipe:
    recipe = (
        session.query(Recipe)
        .options(*_recipe_load_options())
        .filter(
            Recipe.id == recipe_id,
            or_(
                and_(Recipe.source == "system", Recipe.user_id.is_(None)),
                and_(Recipe.user_id == user_id, Recipe.source != "system"),
            ),
        )
        .first()
    )
    if not recipe:
        raise RecipeServiceError("Recipe not found", 404)
    return recipe


def load_visible_recipe(session: Session, user_id: int, recipe_id: int) -> Recipe:
    return _load_recipe(session, user_id, recipe_id)


def list_recipes(session: Session, user_id: int, *, own_only: bool = False) -> list[dict]:
    locale = ui_locale_for_user(session, user_id)
    market_code = market_code_for_user(session, user_id)
    favorites = _favorite_recipe_ids(session, user_id)
    base_query = (
        session.query(Recipe)
        .options(*_recipe_load_options())
        .filter(Recipe.user_id == user_id, Recipe.source != "system")
        if own_only
        else _visible_recipes_query(session, user_id)
    )
    recipes = base_query.order_by(Recipe.catalog_key.asc().nulls_last(), Recipe.id.asc()).all()
    return [
        recipe_to_summary(
            r,
            locale=locale,
            market_code=market_code,
            is_favorite=_is_favorite(session, user_id, r, favorites),
        )
        for r in recipes
    ]


def get_recipe(session: Session, user_id: int, recipe_id: int) -> dict:
    recipe = _load_recipe(session, user_id, recipe_id)
    locale = ui_locale_for_user(session, user_id)
    market_code = market_code_for_user(session, user_id)
    favorites = _favorite_recipe_ids(session, user_id)
    return recipe_to_dict(
        recipe,
        locale=locale,
        market_code=market_code,
        is_favorite=_is_favorite(session, user_id, recipe, favorites),
    )


def create_recipe(session: Session, user_id: int, data: dict) -> dict:
    if not data or "name" not in data:
        raise RecipeServiceError("Required field: name", 400)
    if len(str(data["name"])) > 200:
        raise RecipeServiceError("Recipe name max 200 characters", 400)
    notes = data.get("notes") or ""
    if len(notes) > 5000:
        raise RecipeServiceError("Notes max 5000 characters", 400)

    try:
        servings = int(data.get("servings", 0))
    except (TypeError, ValueError):
        raise RecipeServiceError("Servings must be a whole number", 400)
    if servings < 1 or servings > 999:
        raise RecipeServiceError("Servings must be between 1 and 999", 400)

    existing = (
        session.query(Recipe)
        .filter_by(user_name=data["name"], user_id=user_id)
        .first()
    )
    if existing:
        session.delete(existing)
        session.flush()

    recipe = Recipe(
        user_name=data["name"],
        user_id=user_id,
        source="user",
        notes=data.get("notes"),
        category=data.get("category") or None,
        servings=servings,
    )
    session.add(recipe)
    session.flush()

    for ingredient in data.get("ingredients", []):
        if not all(k in ingredient for k in ("product_id", "weight")):
            raise RecipeServiceError("Ingredient requires: product_id, weight", 400)
        try:
            weight = float(ingredient["weight"])
        except (TypeError, ValueError):
            raise RecipeServiceError("Invalid ingredient weight", 400)
        if weight <= 0 or weight > 99999:
            raise RecipeServiceError("Ingredient weight must be between 0 and 99999", 400)
        per_serving = round(weight / servings, 2)
        product = resolve_visible_product(session, user_id, int(ingredient["product_id"]))
        if not product:
            raise RecipeServiceError(f'Product {ingredient["product_id"]} not found', 404)
        session.add(
            RecipeIngredient(
                recipe_id=recipe.id,
                product_id=ingredient["product_id"],
                weight=per_serving,
            )
        )

    session.commit()
    return get_recipe(session, user_id, recipe.id)


def update_recipe(session: Session, user_id: int, recipe_id: int, data: dict) -> dict:
    recipe = _load_recipe(session, user_id, recipe_id)
    if recipe.source == "system" and recipe.user_id is None:
        raise RecipeServiceError("System catalog recipes cannot be modified", 403)

    if "name" in data:
        recipe.user_name = data["name"]
    if "notes" in data:
        recipe.notes = data["notes"] or None
    if "category" in data:
        recipe.category = data["category"] or None
    if "ingredients" in data:
        session.query(RecipeIngredient).filter_by(recipe_id=recipe_id).delete()
        for ingredient in data["ingredients"]:
            try:
                weight = float(ingredient["weight"])
            except (TypeError, ValueError):
                raise RecipeServiceError("Invalid ingredient weight", 400)
            if weight <= 0 or weight > 99999:
                raise RecipeServiceError("Ingredient weight must be between 0 and 99999", 400)
            product = resolve_visible_product(session, user_id, int(ingredient["product_id"]))
            if not product:
                raise RecipeServiceError(f'Product {ingredient["product_id"]} not found', 404)
            session.add(
                RecipeIngredient(
                    recipe_id=recipe_id,
                    product_id=ingredient["product_id"],
                    weight=weight,
                )
            )

    session.commit()
    return get_recipe(session, user_id, recipe_id)


def toggle_favorite(session: Session, user_id: int, recipe_id: int) -> dict:
    recipe = _load_recipe(session, user_id, recipe_id)
    if recipe.source == "system" and recipe.user_id is None:
        existing = (
            session.query(UserRecipeFavorite)
            .filter_by(user_id=user_id, recipe_id=recipe_id)
            .first()
        )
        if existing:
            session.delete(existing)
            session.commit()
            return {"is_favorite": False}
        session.add(UserRecipeFavorite(user_id=user_id, recipe_id=recipe_id))
        session.commit()
        return {"is_favorite": True}

    recipe.is_favorite = not recipe.is_favorite
    session.commit()
    return {"is_favorite": recipe.is_favorite}


def update_category(session: Session, user_id: int, recipe_id: int, category: str | None) -> dict:
    recipe = _load_recipe(session, user_id, recipe_id)
    if recipe.source == "system" and recipe.user_id is None:
        raise RecipeServiceError("System catalog recipes cannot be modified", 403)
    recipe.category = category or None
    session.commit()
    return {"category": recipe.category}


def fetch_recipe_image(session: Session, user_id: int, recipe_id: int) -> dict:
    recipe = _load_recipe(session, user_id, recipe_id)
    if recipe.source == "system" and recipe.user_id is None:
        raise RecipeServiceError("System catalog recipes cannot be modified", 403)
    locale = ui_locale_for_user(session, user_id)
    image_url = resolve_recipe_image(recipe, locale=locale)
    if image_url:
        recipe.image_url = image_url
        session.commit()
    return {"image_url": recipe.image_url}


def delete_recipe(session: Session, user_id: int, recipe_id: int) -> None:
    recipe = _load_recipe(session, user_id, recipe_id)
    if recipe.source == "system" and recipe.user_id is None:
        raise RecipeServiceError("System catalog recipes cannot be deleted", 403)
    session.query(MealPlan).filter_by(recipe_id=recipe_id).delete()
    session.delete(recipe)
    session.commit()


def delete_all_recipes(session: Session, user_id: int) -> int:
    recipe_ids = [
        r.id
        for r in session.query(Recipe)
        .filter_by(user_id=user_id)
        .filter(Recipe.source != "system")
        .all()
    ]
    if recipe_ids:
        session.query(MealPlan).filter(MealPlan.recipe_id.in_(recipe_ids)).delete(
            synchronize_session=False
        )
        session.query(RecipeIngredient).filter(
            RecipeIngredient.recipe_id.in_(recipe_ids)
        ).delete(synchronize_session=False)
    count = (
        session.query(Recipe)
        .filter_by(user_id=user_id)
        .filter(Recipe.source != "system")
        .delete()
    )
    session.commit()
    return count
