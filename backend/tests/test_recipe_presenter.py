"""Tests for recipe macro presentation."""

from app.models.recipe import Recipe, RecipeIngredient
from app.services.recipe_presenter import recipe_to_summary


def test_recipe_macros_from_ingredients_when_kcal_100g_default_zero(db_session, user, product):
    """User recipes default kcal_100g=0; macros must sum from linked products."""
    recipe = Recipe(
        user_name="Test bowl",
        user_id=user.id,
        source="user",
        category="lunch",
        servings=1,
        kcal_100g=0,
        protein_100g=0,
        fat_100g=0,
        carbs_100g=0,
    )
    db_session.add(recipe)
    db_session.flush()
    db_session.add(RecipeIngredient(recipe_id=recipe.id, product_id=product.id, weight=200))
    db_session.commit()
    db_session.refresh(recipe)

    summary = recipe_to_summary(recipe, locale="pl", market_code="PL")

    # product fixture: 60 kcal/100g × 200g = 120 kcal
    assert summary["total_kcal"] == 120
    assert summary["total_protein"] == 8.0
    assert summary["total_fat"] == 6.0
    assert summary["total_carbs"] == 10.0


def test_recipe_macros_from_per_100g_when_set(db_session, user):
    """Catalog recipes with explicit kcal/100g use weight-based scaling."""
    recipe = Recipe(
        user_name="Catalog item",
        user_id=None,
        source="system",
        category="lunch",
        servings=1,
        kcal_100g=200,
        protein_100g=10,
        fat_100g=8,
        carbs_100g=20,
    )
    db_session.add(recipe)
    db_session.flush()
    db_session.commit()
    db_session.refresh(recipe)

    summary = recipe_to_summary(recipe, locale="pl", market_code="PL")

    assert summary["total_kcal"] == 0
    assert summary["kcal_100g"] == 200
