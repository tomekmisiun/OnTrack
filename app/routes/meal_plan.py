from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app import db
from app.models.meal_plan import MealPlan
from app.models.recipe import Recipe
from app.models.household_member import HouseholdMember
from app.utils import current_uid, current_user_lang
from datetime import date, timedelta
import math

meal_plan_bp = Blueprint('meal_plan', __name__)


def resolve_member_id(uid, member_id=None):
    """Return member_id if it belongs to uid, else primary member's id."""
    if member_id:
        m = HouseholdMember.query.filter_by(id=int(member_id), user_id=uid).first()
        if m:
            return m.id
    primary = HouseholdMember.query.filter_by(user_id=uid, is_primary=True).first()
    return primary.id if primary else None


def member_ids_for_user(uid, ids_str=None):
    """Parse comma-separated member_ids, verify ownership, return list."""
    if ids_str:
        try:
            requested = [int(x) for x in ids_str.split(',') if x.strip()]
        except ValueError:
            return []
        owned = {m.id for m in HouseholdMember.query.filter_by(user_id=uid).all()}
        return [mid for mid in requested if mid in owned]
    # default: all members of user
    return [m.id for m in HouseholdMember.query.filter_by(user_id=uid).all()]


@meal_plan_bp.route('/<string:date_str>', methods=['GET'])
@jwt_required()
def get_day(date_str):
    uid = current_uid()
    lang = current_user_lang()
    try:
        day = date.fromisoformat(date_str)
    except ValueError:
        return jsonify({'error': 'Invalid date format'}), 400

    ids_str = request.args.get('member_ids')
    mid = request.args.get('member_id')
    if ids_str:
        mids = member_ids_for_user(uid, ids_str)
    else:
        mids = [resolve_member_id(uid, mid)]

    meals = MealPlan.query.join(Recipe).filter(
        MealPlan.member_id.in_(mids),
        MealPlan.date == day,
        Recipe.lang == lang,
    ).order_by(MealPlan.position).all()
    return jsonify([m.to_dict() for m in meals])


@meal_plan_bp.route('/range/<string:start>/<string:end>', methods=['GET'])
@jwt_required()
def get_range(start, end):
    uid = current_uid()
    lang = current_user_lang()
    try:
        start_date = date.fromisoformat(start)
        end_date = date.fromisoformat(end)
    except ValueError:
        return jsonify({'error': 'Invalid date format'}), 400

    ids_str = request.args.get('member_ids')
    mid = request.args.get('member_id')
    if ids_str:
        mids = member_ids_for_user(uid, ids_str)
    else:
        mids = [resolve_member_id(uid, mid)]

    meals = MealPlan.query.join(Recipe).filter(
        MealPlan.member_id.in_(mids),
        MealPlan.date >= start_date,
        MealPlan.date <= end_date,
        Recipe.lang == lang,
    ).order_by(MealPlan.date, MealPlan.position).all()

    result = {}
    for meal in meals:
        key = meal.date.isoformat()
        result.setdefault(key, []).append(meal.to_dict())
    return jsonify(result)


@meal_plan_bp.route('/', methods=['POST'])
@jwt_required()
def add_meal():
    uid = current_uid()
    data = request.get_json()
    if not data or not all(k in data for k in ['date', 'position', 'recipe_id']):
        return jsonify({'error': 'Required fields: date, position, recipe_id'}), 400
    if not 1 <= data['position'] <= 5:
        return jsonify({'error': 'Position must be between 1 and 5'}), 400
    try:
        day = date.fromisoformat(data['date'])
    except ValueError:
        return jsonify({'error': 'Invalid date format'}), 400

    mid = resolve_member_id(uid, data.get('member_id'))
    if not mid:
        return jsonify({'error': 'No profile configured'}), 400

    if not Recipe.query.filter_by(id=data['recipe_id'], user_id=uid, lang=current_user_lang()).first():
        return jsonify({'error': 'Recipe not found'}), 404

    existing = MealPlan.query.filter_by(member_id=mid, date=day, position=data['position']).first()
    if existing:
        existing.recipe_id = data['recipe_id']
        db.session.commit()
        return jsonify(existing.to_dict()), 200

    meal = MealPlan(user_id=uid, member_id=mid, date=day, position=data['position'], recipe_id=data['recipe_id'])
    db.session.add(meal)
    db.session.commit()
    return jsonify(meal.to_dict()), 201


@meal_plan_bp.route('/copy', methods=['POST'])
@jwt_required()
def copy_range():
    uid = current_uid()
    data = request.get_json()
    if not data or not all(k in data for k in ['source_start', 'source_end', 'target_start']):
        return jsonify({'error': 'Required fields: source_start, source_end, target_start'}), 400
    try:
        source_start = date.fromisoformat(data['source_start'])
        source_end = date.fromisoformat(data['source_end'])
        target_start = date.fromisoformat(data['target_start'])
    except ValueError:
        return jsonify({'error': 'Invalid date format'}), 400

    mid = resolve_member_id(uid, data.get('member_id'))
    if not mid:
        return jsonify({'error': 'No profile configured'}), 400

    lang = current_user_lang()
    meals = MealPlan.query.join(Recipe).filter(
        MealPlan.member_id == mid,
        MealPlan.date >= source_start,
        MealPlan.date <= source_end,
        Recipe.lang == lang,
    ).all()
    span = (source_end - source_start).days
    target_end = target_start + timedelta(days=span)

    MealPlan.query.filter(
        MealPlan.member_id == mid,
        MealPlan.date >= target_start,
        MealPlan.date <= target_end,
    ).delete()
    for meal in meals:
        new_date = target_start + (meal.date - source_start)
        db.session.add(MealPlan(user_id=uid, member_id=mid, date=new_date, position=meal.position, recipe_id=meal.recipe_id))
    db.session.commit()
    return jsonify({'message': f'Copied {len(meals)} meals'}), 201


@meal_plan_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_meal(id):
    uid = current_uid()
    meal = MealPlan.query.filter_by(id=id).first_or_404()
    # Verify ownership via member
    if meal.member_id:
        member = HouseholdMember.query.filter_by(id=meal.member_id, user_id=uid).first()
        if not member:
            return jsonify({'error': 'Access denied'}), 403
    elif meal.user_id != uid:
        return jsonify({'error': 'Access denied'}), 403
    db.session.delete(meal)
    db.session.commit()
    return jsonify({'message': 'Meal deleted'}), 200


@meal_plan_bp.route('/summary/<string:start>/<string:end>', methods=['GET'])
@jwt_required()
def get_summary(start, end):
    uid = current_uid()
    lang = current_user_lang()
    try:
        start_date = date.fromisoformat(start)
        end_date = date.fromisoformat(end)
    except ValueError:
        return jsonify({'error': 'Invalid date format'}), 400

    ids_str = request.args.get('member_ids')
    mid = request.args.get('member_id')
    if ids_str:
        mids = member_ids_for_user(uid, ids_str)
    else:
        mids = [resolve_member_id(uid, mid)]

    meals = MealPlan.query.join(Recipe).filter(
        MealPlan.member_id.in_(mids),
        MealPlan.date >= start_date,
        MealPlan.date <= end_date,
        Recipe.lang == lang,
    ).all()

    products = {}
    for meal in meals:
        for ingredient in meal.recipe.ingredients:
            pid = ingredient.product_id
            if pid not in products:
                prod = ingredient.product
                products[pid] = {
                    'name': prod.name,
                    'package_weight': prod.package_weight,
                    'unit': prod.unit or 'g',
                    'price': prod.price or 0,
                    'sold_by_weight': bool(prod.sold_by_weight),
                    'total_weight': 0,
                }
            products[pid]['total_weight'] += ingredient.weight

    result, total_cost = [], 0
    for pid, p in products.items():
        unit = p['unit']
        pkg = p['package_weight'] or (1 if unit == 'szt' else 1000)
        total = p['total_weight']
        price_per_unit = p['price']
        sold_by_weight = p.get('sold_by_weight', False)

        if unit == 'szt':
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
        result.append({
            'product_id': pid,
            'product_name': p['name'],
            'total_weight': round(total, 2),
            'unit': unit,
            'package_weight': pkg,
            'packages_exact': round(packages_exact, 2),
            'packages_rounded': round(packages_rounded, 2),
            'price_per_package': round(package_price, 2),
            'total_cost': round(cost, 2),
            'actual_cost': round(actual_cost, 2),
            'sold_by_weight': sold_by_weight,
        })
    return jsonify({'items': sorted(result, key=lambda x: x['product_name']), 'total_cost': round(total_cost, 2)})
