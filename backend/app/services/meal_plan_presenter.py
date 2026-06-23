from app.models.meal_plan import MealPlan
from app.services.recipe_presenter import recipe_to_dict, recipe_to_summary


def meal_to_dict(meal: MealPlan, *, recipe_summary: bool = False) -> dict:
    if meal.recipe is None:
        recipe_data = None
    elif recipe_summary:
        recipe_data = recipe_to_summary(meal.recipe)
    else:
        recipe_data = recipe_to_dict(meal.recipe)
    return {
        "id": meal.id,
        "date": meal.date.isoformat(),
        "position": meal.position,
        "recipe_id": meal.recipe_id,
        "member_id": meal.member_id,
        "recipe": recipe_data,
    }
