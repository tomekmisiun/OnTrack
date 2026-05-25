from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app import db
from app.models.recipe import Recipe, RecipeIngredient
from app.models.meal_plan import MealPlan
from app.models.product import Product
from app.utils import current_uid, current_user_lang
import os

recipes_bp = Blueprint('recipes', __name__)


@recipes_bp.route('/', methods=['GET'])
@jwt_required()
def get_recipes():
    uid = current_uid()
    lang = current_user_lang()
    recipes = Recipe.query.filter_by(user_id=uid, lang=lang).order_by(Recipe.name).all()
    return jsonify([r.to_dict_summary() for r in recipes])


@recipes_bp.route('/<int:id>', methods=['GET'])
@jwt_required()
def get_recipe(id):
    recipe = Recipe.query.filter_by(id=id, user_id=current_uid(), lang=current_user_lang()).first_or_404()
    return jsonify(recipe.to_dict())


@recipes_bp.route('/', methods=['POST'])
@jwt_required()
def create_recipe():
    uid = current_uid()
    lang = current_user_lang()
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({'error': 'Required field: name'}), 400
    if len(str(data['name'])) > 200:
        return jsonify({'error': 'Recipe name max 200 characters'}), 400
    notes = data.get('notes') or ''
    if len(notes) > 5000:
        return jsonify({'error': 'Notes max 5000 characters'}), 400

    try:
        servings = int(data.get('servings', 0))
    except (TypeError, ValueError):
        return jsonify({'error': 'Servings must be a whole number'}), 400
    if servings < 1 or servings > 999:
        return jsonify({'error': 'Servings must be between 1 and 999'}), 400

    existing = Recipe.query.filter_by(name=data['name'], user_id=uid, lang=lang).first()
    if existing:
        db.session.delete(existing)
        db.session.flush()

    recipe = Recipe(
        name=data['name'], user_id=uid, notes=data.get('notes'),
        category=data.get('category') or None, servings=servings, lang=lang,
    )
    db.session.add(recipe)
    db.session.flush()

    for ingredient in data.get('ingredients', []):
        if not all(k in ingredient for k in ['product_id', 'weight']):
            return jsonify({'error': 'Ingredient requires: product_id, weight'}), 400
        try:
            weight = float(ingredient['weight'])
        except (TypeError, ValueError):
            return jsonify({'error': 'Invalid ingredient weight'}), 400
        if weight <= 0 or weight > 99999:
            return jsonify({'error': 'Ingredient weight must be between 0 and 99999'}), 400
        per_serving = round(weight / servings, 2)
        product = Product.query.filter_by(id=ingredient['product_id'], user_id=uid, lang=lang).first()
        if not product:
            return jsonify({'error': f'Product {ingredient["product_id"]} not found'}), 404
        db.session.add(RecipeIngredient(recipe_id=recipe.id, product_id=ingredient['product_id'], weight=per_serving))

    db.session.commit()
    return jsonify(recipe.to_dict()), 201


@recipes_bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
def update_recipe(id):
    uid = current_uid()
    lang = current_user_lang()
    recipe = Recipe.query.filter_by(id=id, user_id=uid, lang=lang).first_or_404()
    data = request.get_json()
    if 'name' in data:
        recipe.name = data['name']
    if 'notes' in data:
        recipe.notes = data['notes'] or None
    if 'category' in data:
        recipe.category = data['category'] or None
    if 'ingredients' in data:
        RecipeIngredient.query.filter_by(recipe_id=id).delete()
        for ingredient in data['ingredients']:
            try:
                weight = float(ingredient['weight'])
            except (TypeError, ValueError):
                return jsonify({'error': 'Invalid ingredient weight'}), 400
            if weight <= 0 or weight > 99999:
                return jsonify({'error': 'Ingredient weight must be between 0 and 99999'}), 400
            product = Product.query.filter_by(id=ingredient['product_id'], user_id=uid, lang=lang).first()
            if not product:
                return jsonify({'error': f'Product {ingredient["product_id"]} not found'}), 404
            db.session.add(RecipeIngredient(recipe_id=id, product_id=ingredient['product_id'], weight=weight))
    db.session.commit()
    return jsonify(recipe.to_dict())


@recipes_bp.route('/<int:id>/category', methods=['PATCH'])
@jwt_required()
def update_category(id):
    recipe = Recipe.query.filter_by(id=id, user_id=current_uid(), lang=current_user_lang()).first_or_404()
    data = request.get_json() or {}
    recipe.category = data.get('category') or None
    db.session.commit()
    return jsonify({'category': recipe.category})


@recipes_bp.route('/<int:id>/favorite', methods=['PATCH'])
@jwt_required()
def toggle_favorite(id):
    recipe = Recipe.query.filter_by(id=id, user_id=current_uid(), lang=current_user_lang()).first_or_404()
    recipe.is_favorite = not recipe.is_favorite
    db.session.commit()
    return jsonify({'is_favorite': recipe.is_favorite})



@recipes_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_recipe(id):
    recipe = Recipe.query.filter_by(id=id, user_id=current_uid(), lang=current_user_lang()).first_or_404()
    MealPlan.query.filter_by(recipe_id=id).delete()
    db.session.delete(recipe)
    db.session.commit()
    return jsonify({'message': 'Recipe deleted'}), 200


@recipes_bp.route('/all', methods=['DELETE'])
@jwt_required()
def delete_all_recipes():
    uid = current_uid()
    lang = current_user_lang()
    recipe_ids = [r.id for r in Recipe.query.filter_by(user_id=uid, lang=lang).all()]
    if recipe_ids:
        MealPlan.query.filter(MealPlan.recipe_id.in_(recipe_ids)).delete(synchronize_session=False)
        RecipeIngredient.query.filter(RecipeIngredient.recipe_id.in_(recipe_ids)).delete(synchronize_session=False)
    count = Recipe.query.filter_by(user_id=uid, lang=lang).delete()
    db.session.commit()
    return jsonify({'message': f'Deleted {count} recipes'}), 200


@recipes_bp.route('/<int:recipe_id>/fetch-image', methods=['POST'])
@jwt_required()
def fetch_recipe_image(recipe_id):
    uid = current_uid()
    recipe = Recipe.query.filter_by(id=recipe_id, user_id=uid, lang=current_user_lang()).first_or_404()

    from app.pexels import fetch_pexels_image, pexels_search_term
    from app.recipe_catalog import english_name_for_recipe

    term = pexels_search_term(
        recipe.name,
        lang=recipe.lang,
        source_url=recipe.source_url,
    )
    if recipe.lang == "pl" and not english_name_for_recipe(recipe.name, recipe.source_url, recipe.lang):
        # Manual PL recipe without pipeline mapping — optional Gemini translate
        gemini_key = os.environ.get('GEMINI_API_KEY')
        if gemini_key:
            try:
                from google import genai
                client = genai.Client(api_key=gemini_key)
                resp = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=(
                        f"Translate this Polish dish name to 1-4 English words suitable for "
                        f"food photo search: '{recipe.name}'. Reply with English words only."
                    ),
                )
                term = pexels_search_term(resp.text.strip(), lang="en")
            except Exception:
                pass

    pexels_key = os.environ.get('PEXELS_API_KEY')
    image_url = fetch_pexels_image(term, pexels_key)

    if image_url:
        recipe.image_url = image_url
        db.session.commit()

    return jsonify({'image_url': recipe.image_url})
