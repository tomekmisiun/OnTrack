from flask import Blueprint, request, jsonify
from app import db
from app.models.recipe import Recipe, RecipeIngredient
from app.models.product import Product

recipes_bp = Blueprint('recipes', __name__)

@recipes_bp.route('/', methods=['GET'])
def get_recipes():
    recipes = Recipe.query.all()
    return jsonify([r.to_dict() for r in recipes])

@recipes_bp.route('/<int:id>', methods=['GET'])
def get_recipe(id):
    recipe = Recipe.query.get_or_404(id)
    return jsonify(recipe.to_dict())

@recipes_bp.route('/', methods=['POST'])
def create_recipe():
    data = request.get_json()

    if not data or 'name' not in data:
        return jsonify({'error': 'Wymagane pole: name'}), 400

    if Recipe.query.filter_by(name=data['name']).first():
        return jsonify({'error': 'Przepis o tej nazwie już istnieje'}), 409

    recipe = Recipe(name=data['name'])
    db.session.add(recipe)
    db.session.flush()  # żeby dostać recipe.id przed commitem

    for ingredient in data.get('ingredients', []):
        if not all(k in ingredient for k in ['product_id', 'weight']):
            return jsonify({'error': 'Składnik wymaga: product_id, weight'}), 400

        product = Product.query.get(ingredient['product_id'])
        if not product:
            return jsonify({'error': f'Produkt {ingredient["product_id"]} nie istnieje'}), 404

        db.session.add(RecipeIngredient(
            recipe_id=recipe.id,
            product_id=ingredient['product_id'],
            weight=ingredient['weight']
        ))

    db.session.commit()
    return jsonify(recipe.to_dict()), 201

@recipes_bp.route('/<int:id>', methods=['PUT'])
def update_recipe(id):
    recipe = Recipe.query.get_or_404(id)
    data = request.get_json()

    if 'name' in data:
        recipe.name = data['name']

    if 'ingredients' in data:
        # usuń stare składniki i dodaj nowe
        RecipeIngredient.query.filter_by(recipe_id=id).delete()
        for ingredient in data['ingredients']:
            if not all(k in ingredient for k in ['product_id', 'weight']):
                return jsonify({'error': 'Składnik wymaga: product_id, weight'}), 400
            product = Product.query.get(ingredient['product_id'])
            if not product:
                return jsonify({'error': f'Produkt {ingredient["product_id"]} nie istnieje'}), 404
            db.session.add(RecipeIngredient(
                recipe_id=id,
                product_id=ingredient['product_id'],
                weight=ingredient['weight']
            ))

    db.session.commit()
    return jsonify(recipe.to_dict())

@recipes_bp.route('/<int:id>', methods=['DELETE'])
def delete_recipe(id):
    recipe = Recipe.query.get_or_404(id)
    db.session.delete(recipe)
    db.session.commit()
    return jsonify({'message': 'Przepis usunięty'}), 200