from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app import db
from app.models.product import Product
from app.models.user import User
from app.utils import current_uid, current_user_lang, looks_like_recipe_ingredient_line

products_bp = Blueprint('products', __name__)

MAX_NUM = 99999
MAX_NAME = 50
MAX_KCAL = 9999
MAX_MACRO = 100
MAX_PRICE = 9999


def _is_catalog_product(p: Product) -> bool:
    """Hide ingredient-line placeholders from the product list."""
    if looks_like_recipe_ingredient_line(p.name):
        return False
    if p.price and p.price > 0:
        return True
    if p.kcal is not None or p.protein is not None:
        return True
    if len(p.name or '') <= 40:
        return True
    return False


def validate_product_data(data, require_all=True):
    if require_all and not all(k in data for k in ['name', 'package_weight', 'price']):
        return 'Required fields: name, package_weight, price'
    if 'name' in data:
        name = str(data['name']).strip()
        if not name:
            return 'Product name cannot be empty'
        if len(name) > MAX_NAME:
            return f'Product name max {MAX_NAME} characters'
    if 'package_weight' in data:
        try:
            w = float(data['package_weight'])
        except (TypeError, ValueError):
            return 'Invalid package weight'
        if w <= 0 or w > MAX_NUM:
            return f'Package weight must be between 0 and {MAX_NUM}'
    if 'price' in data:
        try:
            p = float(data['price'])
        except (TypeError, ValueError):
            return 'Invalid price'
        if p < 0 or p > MAX_PRICE:
            return f'Price must be between 0 and {MAX_PRICE}'
    if 'kcal' in data and data['kcal'] is not None:
        try:
            v = float(data['kcal'])
        except (TypeError, ValueError):
            return 'Invalid kcal value'
        if v < 0 or v > MAX_KCAL:
            return f'Kcal must be between 0 and {MAX_KCAL}'
    for macro in ('protein', 'fat', 'carbs'):
        if macro in data and data[macro] is not None:
            try:
                v = float(data[macro])
            except (TypeError, ValueError):
                return f'Invalid {macro} value'
            if v < 0 or v > MAX_MACRO:
                return f'{macro} must be between 0 and {MAX_MACRO}'
    return None


@products_bp.route('/', methods=['GET'])
@jwt_required()
def get_products():
    uid = current_uid()
    lang = current_user_lang()
    products = [
        p for p in Product.query.filter_by(user_id=uid, lang=lang).order_by(Product.name).all()
        if _is_catalog_product(p)
    ]
    return jsonify([p.to_dict() for p in products])


@products_bp.route('/', methods=['POST'])
@jwt_required()
def create_product():
    data = request.get_json()
    err = validate_product_data(data, require_all=True)
    if err:
        return jsonify({'error': err}), 400

    uid = current_uid()
    user = User.query.get(uid)
    product = Product(
        user_id=uid,
        name=str(data['name']).strip()[:MAX_NAME],
        package_weight=float(data['package_weight']),
        price=float(data['price']),
        unit=str(data.get('unit', 'g'))[:10],
        kcal=float(data['kcal']) if data.get('kcal') is not None else None,
        protein=float(data['protein']) if data.get('protein') is not None else None,
        fat=float(data['fat']) if data.get('fat') is not None else None,
        carbs=float(data['carbs']) if data.get('carbs') is not None else None,
        sold_by_weight=bool(data.get('sold_by_weight', False)),
        lang=user.lang if user else 'pl',
    )
    db.session.add(product)
    db.session.commit()
    return jsonify(product.to_dict()), 201


@products_bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
def update_product(id):
    product = Product.query.filter_by(id=id, user_id=current_uid(), lang=current_user_lang()).first_or_404()
    data = request.get_json()
    err = validate_product_data(data, require_all=False)
    if err:
        return jsonify({'error': err}), 400

    if 'name' in data:
        product.name = str(data['name']).strip()[:MAX_NAME]
    if 'package_weight' in data:
        product.package_weight = float(data['package_weight'])
    if 'price' in data:
        product.price = float(data['price'])
    if 'unit' in data:
        product.unit = str(data['unit'])[:10]
    if 'sold_by_weight' in data:
        product.sold_by_weight = bool(data['sold_by_weight'])
    for macro in ('kcal', 'protein', 'fat', 'carbs'):
        if macro in data:
            product.__setattr__(macro, float(data[macro]) if data[macro] is not None else None)
    db.session.commit()
    return jsonify(product.to_dict())


@products_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_product(id):
    product = Product.query.filter_by(id=id, user_id=current_uid(), lang=current_user_lang()).first_or_404()
    db.session.delete(product)
    db.session.commit()
    return jsonify({'message': 'Product deleted'}), 200


@products_bp.route('/all', methods=['DELETE'])
@jwt_required()
def delete_all_products():
    uid = current_uid()
    lang = current_user_lang()
    count = Product.query.filter_by(user_id=uid, lang=lang).delete()
    db.session.commit()
    return jsonify({'message': f'Deleted {count} products'}), 200
