from sqlalchemy.orm import Session, joinedload

from app.models.meal_plan import MealPlan
from app.models.recipe import Recipe, RecipeIngredient
from app.services.product_service import resolve_visible_product
from app.services.recipe_image_service import resolve_recipe_image
from app.services.recipe_presenter import recipe_to_dict, recipe_to_summary
from app.services.user_preferences import catalog_lang_for_user


class RecipeServiceError(Exception):
    def __init__(self, message: str, status_code: int):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def _load_recipe(session: Session, user_id: int, recipe_id: int) -> Recipe:
    lang = catalog_lang_for_user(session, user_id)
    recipe = (
        session.query(Recipe)
        .options(joinedload(Recipe.ingredients).joinedload(RecipeIngredient.product))
        .filter_by(id=recipe_id, user_id=user_id, lang=lang)
        .first()
    )
    if not recipe:
        raise RecipeServiceError("Recipe not found", 404)
    return recipe


def list_recipes(session: Session, user_id: int) -> list[dict]:
    lang = catalog_lang_for_user(session, user_id)
    recipes = (
        session.query(Recipe)
        .options(joinedload(Recipe.ingredients).joinedload(RecipeIngredient.product))
        .filter_by(user_id=user_id, lang=lang)
        .order_by(Recipe.name)
        .all()
    )
    return [recipe_to_summary(r) for r in recipes]


def get_recipe(session: Session, user_id: int, recipe_id: int) -> dict:
    return recipe_to_dict(_load_recipe(session, user_id, recipe_id))


def create_recipe(session: Session, user_id: int, data: dict) -> dict:
    lang = catalog_lang_for_user(session, user_id)
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
        session.query(Recipe).filter_by(name=data["name"], user_id=user_id, lang=lang).first()
    )
    if existing:
        session.delete(existing)
        session.flush()

    recipe = Recipe(
        name=data["name"],
        user_id=user_id,
        notes=data.get("notes"),
        category=data.get("category") or None,
        servings=servings,
        lang=lang,
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
    return recipe_to_dict(_load_recipe(session, user_id, recipe.id))


def update_recipe(session: Session, user_id: int, recipe_id: int, data: dict) -> dict:
    recipe = _load_recipe(session, user_id, recipe_id)

    if "name" in data:
        recipe.name = data["name"]
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
    return recipe_to_dict(_load_recipe(session, user_id, recipe_id))


def toggle_favorite(session: Session, user_id: int, recipe_id: int) -> dict:
    recipe = _load_recipe(session, user_id, recipe_id)
    recipe.is_favorite = not recipe.is_favorite
    session.commit()
    return {"is_favorite": recipe.is_favorite}


def update_category(session: Session, user_id: int, recipe_id: int, category: str | None) -> dict:
    recipe = _load_recipe(session, user_id, recipe_id)
    recipe.category = category or None
    session.commit()
    return {"category": recipe.category}


def fetch_recipe_image(session: Session, user_id: int, recipe_id: int) -> dict:
    recipe = _load_recipe(session, user_id, recipe_id)
    image_url = resolve_recipe_image(recipe)
    if image_url:
        recipe.image_url = image_url
        session.commit()
    return {"image_url": recipe.image_url}


def delete_recipe(session: Session, user_id: int, recipe_id: int) -> None:
    recipe = _load_recipe(session, user_id, recipe_id)
    session.query(MealPlan).filter_by(recipe_id=recipe_id).delete()
    session.delete(recipe)
    session.commit()


def delete_all_recipes(session: Session, user_id: int) -> int:
    lang = catalog_lang_for_user(session, user_id)
    recipe_ids = [r.id for r in session.query(Recipe).filter_by(user_id=user_id, lang=lang).all()]
    if recipe_ids:
        session.query(MealPlan).filter(MealPlan.recipe_id.in_(recipe_ids)).delete(
            synchronize_session=False
        )
        session.query(RecipeIngredient).filter(
            RecipeIngredient.recipe_id.in_(recipe_ids)
        ).delete(synchronize_session=False)
    count = session.query(Recipe).filter_by(user_id=user_id, lang=lang).delete()
    session.commit()
    return count
