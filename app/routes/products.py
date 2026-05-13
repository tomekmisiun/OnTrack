from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.product import Product

products_bp = Blueprint('products', __name__)


def current_uid():
    return int(get_jwt_identity())


@products_bp.route('/', methods=['GET'])
@jwt_required()
def get_products():
    products = Product.query.filter_by(user_id=current_uid()).order_by(Product.name).all()
    return jsonify([p.to_dict() for p in products])


@products_bp.route('/', methods=['POST'])
@jwt_required()
def create_product():
    data = request.get_json()
    if not data or not all(k in data for k in ['name', 'package_weight', 'price']):
        return jsonify({'error': 'Wymagane pola: name, package_weight, price'}), 400

    product = Product(
        user_id=current_uid(),
        name=data['name'],
        package_weight=data['package_weight'],
        price=data['price'],
        unit=data.get('unit', 'g'),
    )
    db.session.add(product)
    db.session.commit()
    return jsonify(product.to_dict()), 201


@products_bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
def update_product(id):
    product = Product.query.filter_by(id=id, user_id=current_uid()).first_or_404()
    data = request.get_json()
    for field in ('name', 'package_weight', 'price', 'unit'):
        if field in data:
            setattr(product, field, data[field])
    db.session.commit()
    return jsonify(product.to_dict())


@products_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_product(id):
    product = Product.query.filter_by(id=id, user_id=current_uid()).first_or_404()
    db.session.delete(product)
    db.session.commit()
    return jsonify({'message': 'Produkt usunięty'}), 200
