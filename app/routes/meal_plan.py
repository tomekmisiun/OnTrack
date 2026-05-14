from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.meal_plan import MealPlan
from app.models.recipe import Recipe
from datetime import date, timedelta
import math

meal_plan_bp = Blueprint('meal_plan', __name__)


def current_uid():
    return int(get_jwt_identity())


@meal_plan_bp.route('/<string:date_str>', methods=['GET'])
@jwt_required()
def get_day(date_str):
    try:
        day = date.fromisoformat(date_str)
    except ValueError:
        return jsonify({'error': 'Nieprawidłowy format daty'}), 400
    meals = MealPlan.query.filter_by(user_id=current_uid(), date=day).order_by(MealPlan.position).all()
    return jsonify([m.to_dict() for m in meals])


@meal_plan_bp.route('/range/<string:start>/<string:end>', methods=['GET'])
@jwt_required()
def get_range(start, end):
    try:
        start_date = date.fromisoformat(start)
        end_date = date.fromisoformat(end)
    except ValueError:
        return jsonify({'error': 'Nieprawidłowy format daty'}), 400
    meals = MealPlan.query.filter(
        MealPlan.user_id == current_uid(),
        MealPlan.date >= start_date,
        MealPlan.date <= end_date,
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
        return jsonify({'error': 'Wymagane pola: date, position, recipe_id'}), 400
    if not 1 <= data['position'] <= 5:
        return jsonify({'error': 'Pozycja musi być między 1 a 5'}), 400
    try:
        day = date.fromisoformat(data['date'])
    except ValueError:
        return jsonify({'error': 'Nieprawidłowy format daty'}), 400
    if not Recipe.query.filter_by(id=data['recipe_id'], user_id=uid).first():
        return jsonify({'error': 'Przepis nie istnieje'}), 404
    if MealPlan.query.filter_by(user_id=uid, date=day, position=data['position']).first():
        return jsonify({'error': f'Pozycja {data["position"]} w tym dniu jest już zajęta'}), 409
    meal = MealPlan(user_id=uid, date=day, position=data['position'], recipe_id=data['recipe_id'])
    db.session.add(meal)
    db.session.commit()
    return jsonify(meal.to_dict()), 201


@meal_plan_bp.route('/copy', methods=['POST'])
@jwt_required()
def copy_range():
    uid = current_uid()
    data = request.get_json()
    if not data or not all(k in data for k in ['source_start', 'source_end', 'target_start']):
        return jsonify({'error': 'Wymagane pola: source_start, source_end, target_start'}), 400
    try:
        source_start = date.fromisoformat(data['source_start'])
        source_end = date.fromisoformat(data['source_end'])
        target_start = date.fromisoformat(data['target_start'])
    except ValueError:
        return jsonify({'error': 'Nieprawidłowy format daty'}), 400
    meals = MealPlan.query.filter(
        MealPlan.user_id == uid,
        MealPlan.date >= source_start,
        MealPlan.date <= source_end,
    ).all()
    span = (source_end - source_start).days
    target_end = target_start + timedelta(days=span)
    # Delete existing meals in target range before copying (overwrite behaviour)
    MealPlan.query.filter(
        MealPlan.user_id == uid,
        MealPlan.date >= target_start,
        MealPlan.date <= target_end,
    ).delete()
    for meal in meals:
        new_date = target_start + (meal.date - source_start)
        db.session.add(MealPlan(user_id=uid, date=new_date, position=meal.position, recipe_id=meal.recipe_id))
    db.session.commit()
    return jsonify({'message': f'Skopiowano {len(meals)} posiłków'}), 201


@meal_plan_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_meal(id):
    meal = MealPlan.query.filter_by(id=id, user_id=current_uid()).first_or_404()
    db.session.delete(meal)
    db.session.commit()
    return jsonify({'message': 'Posiłek usunięty'}), 200


@meal_plan_bp.route('/summary/<string:start>/<string:end>', methods=['GET'])
@jwt_required()
def get_summary(start, end):
    uid = current_uid()
    try:
        start_date = date.fromisoformat(start)
        end_date = date.fromisoformat(end)
    except ValueError:
        return jsonify({'error': 'Nieprawidłowy format daty'}), 400
    meals = MealPlan.query.filter(
        MealPlan.user_id == uid,
        MealPlan.date >= start_date,
        MealPlan.date <= end_date,
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
                    'price': prod.price or 0,  # per 100g/100ml/szt
                    'total_weight': 0,
                }
            products[pid]['total_weight'] += ingredient.weight
    result, total_cost = [], 0
    for pid, p in products.items():
        pkg = p['package_weight']
        unit = p['unit']
        total = p['total_weight']
        price_per_unit = p['price']

        # cena jednego opakowania
        if unit == 'szt':
            package_price = price_per_unit * pkg
        else:
            package_price = price_per_unit * pkg / 100

        packages_exact = total / pkg
        packages_rounded = math.ceil(packages_exact)
        cost = packages_rounded * package_price
        total_cost += cost
        result.append({
            'product_name': p['name'],
            'total_weight': round(total, 2),
            'unit': unit,
            'package_weight': pkg,
            'packages_exact': round(packages_exact, 2),
            'packages_rounded': packages_rounded,
            'price_per_package': round(package_price, 2),
            'total_cost': round(cost, 2),
        })
    return jsonify({'items': sorted(result, key=lambda x: x['product_name']), 'total_cost': round(total_cost, 2)})
