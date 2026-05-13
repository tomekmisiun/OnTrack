from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.recipe import Recipe, RecipeIngredient
from app.models.product import Product

recipes_bp = Blueprint('recipes', __name__)


def current_uid():
    return int(get_jwt_identity())


@recipes_bp.route('/', methods=['GET'])
@jwt_required()
def get_recipes():
    recipes = Recipe.query.filter_by(user_id=current_uid()).order_by(Recipe.name).all()
    return jsonify([r.to_dict() for r in recipes])


@recipes_bp.route('/<int:id>', methods=['GET'])
@jwt_required()
def get_recipe(id):
    recipe = Recipe.query.filter_by(id=id, user_id=current_uid()).first_or_404()
    return jsonify(recipe.to_dict())


@recipes_bp.route('/', methods=['POST'])
@jwt_required()
def create_recipe():
    uid = current_uid()
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({'error': 'Wymagane pole: name'}), 400

    if Recipe.query.filter_by(name=data['name'], user_id=uid).first():
        return jsonify({'error': 'Przepis o tej nazwie już istnieje'}), 409

    recipe = Recipe(name=data['name'], user_id=uid)
    db.session.add(recipe)
    db.session.flush()

    for ingredient in data.get('ingredients', []):
        if not all(k in ingredient for k in ['product_id', 'weight']):
            return jsonify({'error': 'Składnik wymaga: product_id, weight'}), 400
        product = Product.query.filter_by(id=ingredient['product_id'], user_id=uid).first()
        if not product:
            return jsonify({'error': f'Produkt {ingredient["product_id"]} nie istnieje'}), 404
        db.session.add(RecipeIngredient(recipe_id=recipe.id, product_id=ingredient['product_id'], weight=ingredient['weight']))

    db.session.commit()
    return jsonify(recipe.to_dict()), 201


@recipes_bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
def update_recipe(id):
    uid = current_uid()
    recipe = Recipe.query.filter_by(id=id, user_id=uid).first_or_404()
    data = request.get_json()
    if 'name' in data:
        recipe.name = data['name']
    if 'ingredients' in data:
        RecipeIngredient.query.filter_by(recipe_id=id).delete()
        for ingredient in data['ingredients']:
            product = Product.query.filter_by(id=ingredient['product_id'], user_id=uid).first()
            if not product:
                return jsonify({'error': f'Produkt {ingredient["product_id"]} nie istnieje'}), 404
            db.session.add(RecipeIngredient(recipe_id=id, product_id=ingredient['product_id'], weight=ingredient['weight']))
    db.session.commit()
    return jsonify(recipe.to_dict())


@recipes_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_recipe(id):
    recipe = Recipe.query.filter_by(id=id, user_id=current_uid()).first_or_404()
    db.session.delete(recipe)
    db.session.commit()
    return jsonify({'message': 'Przepis usunięty'}), 200
