from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.product import Product

products_bp = Blueprint('products', __name__)

MAX_NUM = 99999
MAX_NAME = 50
MAX_KCAL = 9999
MAX_MACRO = 100
MAX_PRICE = 9999


def current_uid():
    return int(get_jwt_identity())


def validate_product_data(data, require_all=True):
    if require_all and not all(k in data for k in ['name', 'package_weight', 'price']):
        return 'Wymagane pola: name, package_weight, price'
    if 'name' in data:
        name = str(data['name']).strip()
        if not name:
            return 'Nazwa produktu nie może być pusta'
        if len(name) > MAX_NAME:
            return f'Nazwa produktu max {MAX_NAME} znaków'
    if 'package_weight' in data:
        try:
            w = float(data['package_weight'])
        except (TypeError, ValueError):
            return 'Nieprawidłowa gramatura opakowania'
        if w <= 0 or w > MAX_NUM:
            return f'Gramatura musi być między 0 a {MAX_NUM}'
    if 'price' in data:
        try:
            p = float(data['price'])
        except (TypeError, ValueError):
            return 'Nieprawidłowa cena'
        if p < 0 or p > MAX_PRICE:
            return f'Cena musi być między 0 a {MAX_PRICE}'
    if 'kcal' in data and data['kcal'] is not None:
        try:
            v = float(data['kcal'])
        except (TypeError, ValueError):
            return 'Nieprawidłowa wartość kcal'
        if v < 0 or v > MAX_KCAL:
            return f'Kcal musi być między 0 a {MAX_KCAL}'
    for macro in ('protein', 'fat', 'carbs'):
        if macro in data and data[macro] is not None:
            try:
                v = float(data[macro])
            except (TypeError, ValueError):
                return f'Nieprawidłowa wartość {macro}'
            if v < 0 or v > MAX_MACRO:
                return f'{macro} musi być między 0 a {MAX_MACRO}'
    return None


@products_bp.route('/', methods=['GET'])
@jwt_required()
def get_products():
    products = Product.query.filter_by(user_id=current_uid()).order_by(Product.name).all()
    return jsonify([p.to_dict() for p in products])


@products_bp.route('/', methods=['POST'])
@jwt_required()
def create_product():
    data = request.get_json()
    err = validate_product_data(data, require_all=True)
    if err:
        return jsonify({'error': err}), 400

    product = Product(
        user_id=current_uid(),
        name=str(data['name']).strip()[:MAX_NAME],
        package_weight=float(data['package_weight']),
        price=float(data['price']),
        unit=str(data.get('unit', 'g'))[:10],
        kcal=float(data['kcal']) if data.get('kcal') is not None else None,
        protein=float(data['protein']) if data.get('protein') is not None else None,
        fat=float(data['fat']) if data.get('fat') is not None else None,
        carbs=float(data['carbs']) if data.get('carbs') is not None else None,
        sold_by_weight=bool(data.get('sold_by_weight', False)),
    )
    db.session.add(product)
    db.session.commit()
    return jsonify(product.to_dict()), 201


@products_bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
def update_product(id):
    product = Product.query.filter_by(id=id, user_id=current_uid()).first_or_404()
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
    product = Product.query.filter_by(id=id, user_id=current_uid()).first_or_404()
    db.session.delete(product)
    db.session.commit()
    return jsonify({'message': 'Produkt usunięty'}), 200


@products_bp.route('/all', methods=['DELETE'])
@jwt_required()
def delete_all_products():
    uid = current_uid()
    count = Product.query.filter_by(user_id=uid).delete()
    db.session.commit()
    return jsonify({'message': f'Usunięto {count} produktów'}), 200
