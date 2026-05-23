from datetime import date

from app.models.household_member import HouseholdMember
from app.models.meal_plan import MealPlan
from app.models.product import Product
from app.models.recipe import Recipe
from app.models.user import User
from app import db


def test_delete_account_removes_user_data(client, auth_headers, user, product, recipe, member):
    meal = MealPlan(
        user_id=user.id,
        member_id=member.id,
        date=date.fromisoformat("2026-05-23"),
        position=1,
        recipe_id=recipe.id,
    )
    db.session.add(meal)
    db.session.commit()
    uid = user.id

    res = client.delete("/api/auth/me", headers=auth_headers)
    assert res.status_code == 200

    assert User.query.get(uid) is None
    assert Product.query.filter_by(user_id=uid).count() == 0
    assert Recipe.query.filter_by(user_id=uid).count() == 0
    assert MealPlan.query.filter_by(user_id=uid).count() == 0
    assert HouseholdMember.query.filter_by(user_id=uid).count() == 0
