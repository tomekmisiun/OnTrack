from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.recipe import Recipe, RecipeIngredient
from app.models.product import Product
from app.models.recipe_parse_log import RecipeParseLog
import json, re, os

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


PARSE_DAILY_LIMIT = 2

@recipes_bp.route('/parse-text', methods=['POST'])
@jwt_required()
def parse_recipe_text():
    uid = current_uid()

    today_count = RecipeParseLog.get_today_count(uid)
    if today_count >= PARSE_DAILY_LIMIT:
        return jsonify({'error': f'Dzienny limit {PARSE_DAILY_LIMIT} parsowań przepisów wyczerpany. Spróbuj jutro.'}), 429

    data = request.get_json() or {}
    recipe_text = (data.get('text') or '').strip()
    if not recipe_text:
        return jsonify({'error': 'Brak tekstu przepisu'}), 400

    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return jsonify({'error': 'Brak klucza GEMINI_API_KEY'}), 500

    products = Product.query.filter_by(user_id=uid).order_by(Product.name).all()
    product_lines = '\n'.join(f"{p.id} | {p.name} | {p.unit}" for p in products)

    prompt = f"""Parse this Polish recipe. Match each ingredient to the closest product from the list.

Recipe text:
{recipe_text}

Available products (ID | Name | Unit):
{product_lines}

Return ONLY valid JSON (no markdown, no explanation):
{{
  "recipe_name": "recipe name from first line",
  "ingredients": [
    {{"ingredient_text": "original phrase", "product_id": 123, "weight": 50, "unit": "g"}},
    ...
  ]
}}

Rules:
- ingredient_text: the original ingredient phrase from the recipe
- product_id: best matching product ID, or null if no match
- weight: numeric amount converted to product unit (g/ml/szt). Polish units: łyżeczka=5g, łyżka=15g, szklanka=250, szczypta=1g, pęczek=50g, pół=0.5x
- unit: match the product's unit
- Handle Polish grammar: mąki→mąka, masła→masło, cukru→cukier, soli→sól, wołowego→wołowina etc.
- "X i warzyw z Y" means just X is the ingredient — ignore context after "i"
- Lines like "przyprawy: sól, pieprz" → parse each as separate ingredient
- If ingredient quantity is unclear, estimate a reasonable amount"""

    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        raw = response.text
    except Exception as e:
        return jsonify({'error': f'Błąd Gemini API: {str(e)}'}), 502
    match = re.search(r'\{.*\}', raw, re.DOTALL)
    if not match:
        return jsonify({'error': 'AI nie zwróciło poprawnego JSON'}), 500

    try:
        result = json.loads(match.group())
        ingredients = []
        for ing in result.get('ingredients', []):
            if not isinstance(ing, dict):
                continue
            pid = ing.get('product_id')
            w = ing.get('weight', 0)
            ingredients.append({
                'ingredient_text': str(ing.get('ingredient_text', ''))[:200],
                'product_id': int(pid) if pid is not None and str(pid).isdigit() else (int(pid) if isinstance(pid, (int, float)) and pid else None),
                'weight': round(float(w), 1) if w else 0,
                'unit': str(ing.get('unit', 'g'))[:5],
            })
    except (json.JSONDecodeError, ValueError, TypeError) as e:
        return jsonify({'error': 'Błąd przetwarzania odpowiedzi AI'}), 500

    RecipeParseLog.increment(uid)

    return jsonify({
        'recipe_name': str(result.get('recipe_name', ''))[:200],
        'ingredients': ingredients,
        'remaining_today': PARSE_DAILY_LIMIT - today_count - 1,
    })
