from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
import requests

nutrition_bp = Blueprint('nutrition', __name__)

OFF_URL = 'https://world.openfoodfacts.org/cgi/search.pl'


@nutrition_bp.route('/lookup', methods=['GET'])
@jwt_required()
def lookup():
    name = (request.args.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Product name is required'}), 400

    try:
        resp = requests.get(OFF_URL, params={
            'search_terms': name,
            'search_simple': 1,
            'action': 'process',
            'json': 1,
            'page_size': 5,
            'fields': 'product_name,nutriments,product_name_pl',
        }, timeout=8, headers={
            'User-Agent': 'MealPlanner/1.0 (personal meal planning app)',
        })
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return jsonify({'error': 'Failed to connect to Open Food Facts'}), 502

    products = data.get('products', [])
    if not products:
        return jsonify({'found': False})

    # Pick first product that has nutritional data
    for p in products:
        n = p.get('nutriments', {})
        kcal = n.get('energy-kcal_100g') or n.get('energy_100g')
        if kcal:
            if kcal > 900:  # energy in kJ — convert to kcal
                kcal = round(kcal / 4.184, 1)
            return jsonify({
                'found': True,
                'product_name': p.get('product_name_pl') or p.get('product_name', ''),
                'kcal':    round(float(kcal), 1),
                'protein': round(float(n.get('proteins_100g', 0)), 1),
                'fat':     round(float(n.get('fat_100g', 0)), 1),
                'carbs':   round(float(n.get('carbohydrates_100g', 0)), 1),
            })

    return jsonify({'found': False})
