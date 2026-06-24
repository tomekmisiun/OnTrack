import math
from datetime import date, timedelta

from sqlalchemy.orm import Session, joinedload

from app.models.household_member import HouseholdMember
from app.models.meal_plan import MealPlan
from app.models.recipe import Recipe, RecipeIngredient
from app.services.meal_plan_presenter import meal_to_dict
from app.services.user_preferences import catalog_lang_for_user


class MealPlanServiceError(Exception):
    def __init__(self, message: str, status_code: int):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def _meals_query(session: Session):
    return session.query(MealPlan).options(
        joinedload(MealPlan.recipe).selectinload(Recipe.ingredients).selectinload(
            RecipeIngredient.product
        ),
    )


def _serialize_meal(session: Session, meal_id: int) -> dict | None:
    meal = _meals_query(session).filter(MealPlan.id == meal_id).first()
    return meal_to_dict(meal, recipe_summary=True) if meal else None


def resolve_member_id(session: Session, user_id: int, member_id: int | None = None) -> int | None:
    if member_id is not None:
        member = (
            session.query(HouseholdMember)
            .filter_by(id=int(member_id), user_id=user_id)
            .first()
        )
        if member:
            return member.id
    primary = (
        session.query(HouseholdMember)
        .filter_by(user_id=user_id, is_primary=True)
        .first()
    )
    return primary.id if primary else None


def member_ids_for_user(
    session: Session, user_id: int, ids_str: str | None = None
) -> list[int]:
    if ids_str:
        try:
            requested = [int(x) for x in ids_str.split(",") if x.strip()]
        except ValueError:
            return []
        owned = {
            m.id for m in session.query(HouseholdMember).filter_by(user_id=user_id).all()
        }
        return [mid for mid in requested if mid in owned]
    return [
        m.id for m in session.query(HouseholdMember).filter_by(user_id=user_id).all()
    ]


def _member_ids_from_params(
    session: Session,
    user_id: int,
    member_ids: str | None,
    member_id: int | None,
) -> list[int | None]:
    if member_ids:
        return member_ids_for_user(session, user_id, member_ids)
    return [resolve_member_id(session, user_id, member_id)]


def get_day(
    session: Session,
    user_id: int,
    day: date,
    *,
    member_ids: str | None = None,
    member_id: int | None = None,
) -> list[dict]:
    lang = catalog_lang_for_user(session, user_id)
    mids = _member_ids_from_params(session, user_id, member_ids, member_id)
    meals = (
        _meals_query(session)
        .join(Recipe)
        .filter(
            MealPlan.member_id.in_(mids),
            MealPlan.date == day,
            Recipe.lang == lang,
        )
        .order_by(MealPlan.position)
        .all()
    )
    return [meal_to_dict(m, recipe_summary=True) for m in meals]


def get_range(
    session: Session,
    user_id: int,
    start_date: date,
    end_date: date,
    *,
    member_ids: str | None = None,
    member_id: int | None = None,
) -> dict[str, list[dict]]:
    lang = catalog_lang_for_user(session, user_id)
    mids = _member_ids_from_params(session, user_id, member_ids, member_id)
    meals = (
        _meals_query(session)
        .join(Recipe)
        .filter(
            MealPlan.member_id.in_(mids),
            MealPlan.date >= start_date,
            MealPlan.date <= end_date,
            Recipe.lang == lang,
        )
        .order_by(MealPlan.date, MealPlan.position)
        .all()
    )
    result: dict[str, list[dict]] = {}
    for meal in meals:
        key = meal.date.isoformat()
        result.setdefault(key, []).append(meal_to_dict(meal, recipe_summary=True))
    return result


def add_meal(
    session: Session,
    user_id: int,
    *,
    day: date,
    position: int,
    recipe_id: int,
    member_id: int | None = None,
) -> tuple[dict, int]:
    if not 1 <= position <= 5:
        raise MealPlanServiceError("Position must be between 1 and 5", 400)

    mid = resolve_member_id(session, user_id, member_id)
    if not mid:
        raise MealPlanServiceError("No profile configured", 400)

    lang = catalog_lang_for_user(session, user_id)
    recipe = (
        session.query(Recipe)
        .filter_by(id=recipe_id, user_id=user_id, lang=lang)
        .first()
    )
    if not recipe:
        raise MealPlanServiceError("Recipe not found", 404)

    existing = (
        session.query(MealPlan)
        .filter_by(member_id=mid, date=day, position=position)
        .first()
    )
    if existing:
        existing.recipe_id = recipe_id
        session.commit()
        data = _serialize_meal(session, existing.id)
        return data, 200

    meal = MealPlan(
        user_id=user_id,
        member_id=mid,
        date=day,
        position=position,
        recipe_id=recipe_id,
    )
    session.add(meal)
    session.commit()
    session.refresh(meal)
    data = _serialize_meal(session, meal.id)
    return data, 201


def copy_range(
    session: Session,
    user_id: int,
    *,
    source_start: date,
    source_end: date,
    target_start: date,
    member_id: int | None = None,
) -> dict:
    mid = resolve_member_id(session, user_id, member_id)
    if not mid:
        raise MealPlanServiceError("No profile configured", 400)

    lang = catalog_lang_for_user(session, user_id)
    meals = (
        session.query(MealPlan)
        .join(Recipe)
        .filter(
            MealPlan.member_id == mid,
            MealPlan.date >= source_start,
            MealPlan.date <= source_end,
            Recipe.lang == lang,
        )
        .all()
    )
    span = (source_end - source_start).days
    target_end = target_start + timedelta(days=span)

    session.query(MealPlan).filter(
        MealPlan.member_id == mid,
        MealPlan.date >= target_start,
        MealPlan.date <= target_end,
    ).delete()
    for meal in meals:
        new_date = target_start + (meal.date - source_start)
        session.add(
            MealPlan(
                user_id=user_id,
                member_id=mid,
                date=new_date,
                position=meal.position,
                recipe_id=meal.recipe_id,
            )
        )
    session.commit()
    return {"message": f"Copied {len(meals)} meals"}


def delete_meal(session: Session, user_id: int, meal_id: int) -> dict:
    meal = session.query(MealPlan).filter_by(id=meal_id).first()
    if not meal:
        raise MealPlanServiceError("Meal not found", 404)

    if meal.member_id:
        member = (
            session.query(HouseholdMember)
            .filter_by(id=meal.member_id, user_id=user_id)
            .first()
        )
        if not member:
            raise MealPlanServiceError("Access denied", 403)
    elif meal.user_id != user_id:
        raise MealPlanServiceError("Access denied", 403)

    session.delete(meal)
    session.commit()
    return {"message": "Meal deleted"}


def get_summary(
    session: Session,
    user_id: int,
    start_date: date,
    end_date: date,
    *,
    member_ids: str | None = None,
    member_id: int | None = None,
) -> dict:
    lang = catalog_lang_for_user(session, user_id)
    mids = _member_ids_from_params(session, user_id, member_ids, member_id)
    meals = (
        session.query(MealPlan)
        .options(
            joinedload(MealPlan.recipe).selectinload(Recipe.ingredients).selectinload(
                RecipeIngredient.product
            ),
        )
        .join(Recipe)
        .filter(
            MealPlan.member_id.in_(mids),
            MealPlan.date >= start_date,
            MealPlan.date <= end_date,
            Recipe.lang == lang,
        )
        .all()
    )

    products: dict[int, dict] = {}
    for meal in meals:
        for ingredient in meal.recipe.ingredients:
            pid = ingredient.product_id
            if pid not in products:
                prod = ingredient.product
                products[pid] = {
                    "name": prod.name,
                    "package_weight": prod.package_weight,
                    "unit": prod.unit or "g",
                    "price": prod.price or 0,
                    "sold_by_weight": bool(prod.sold_by_weight),
                    "total_weight": 0,
                }
            products[pid]["total_weight"] += ingredient.weight

    result: list[dict] = []
    total_cost = 0.0
    for pid, p in products.items():
        unit = p["unit"]
        pkg = p["package_weight"] or (1 if unit == "szt" else 1000)
        total = p["total_weight"]
        price_per_unit = p["price"]
        sold_by_weight = p.get("sold_by_weight", False)

        if unit == "szt":
            package_price = price_per_unit * pkg
        else:
            package_price = price_per_unit * pkg / 100

        packages_exact = total / pkg
        actual_cost = packages_exact * package_price
        if sold_by_weight:
            packages_rounded = packages_exact
            cost = actual_cost
        else:
            packages_rounded = math.ceil(packages_exact)
            cost = packages_rounded * package_price
        total_cost += cost
        result.append(
            {
                "product_id": pid,
                "product_name": p["name"],
                "total_weight": round(total, 2),
                "unit": unit,
                "package_weight": pkg,
                "packages_exact": round(packages_exact, 2),
                "packages_rounded": round(packages_rounded, 2),
                "price_per_package": round(package_price, 2),
                "total_cost": round(cost, 2),
                "actual_cost": round(actual_cost, 2),
                "sold_by_weight": sold_by_weight,
            }
        )
    return {
        "items": sorted(result, key=lambda x: x["product_name"]),
        "total_cost": round(total_cost, 2),
    }
