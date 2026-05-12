from flask import Blueprint, request, jsonify
from app import db
from app.models.product import Product

products_bp = Blueprint('products', __name__)

@products_bp.route('/', methods=['GET'])
def get_products():
    products = Product.query.all()
    return jsonify([p.to_dict() for p in products])

@products_bp.route('/', methods=['POST'])
def create_product():
    data = request.get_json()

    if not data or not all(k in data for k in ['name', 'package_weight', 'price']):
        return jsonify({'error': 'Wymagane pola: name, package_weight, price'}), 400

    if Product.query.filter_by(name=data['name']).first():
        return jsonify({'error': 'Produkt o tej nazwie już istnieje'}), 409

    product = Product(
        name=data['name'],
        package_weight=data['package_weight'],
        price=data['price']
    )
    db.session.add(product)
    db.session.commit()
    return jsonify(product.to_dict()), 201

@products_bp.route('/<int:id>', methods=['PUT'])
def update_product(id):
    product = Product.query.get_or_404(id)
    data = request.get_json()

    if 'name' in data:
        product.name = data['name']
    if 'package_weight' in data:
        product.package_weight = data['package_weight']
    if 'price' in data:
        product.price = data['price']

    db.session.commit()
    return jsonify(product.to_dict())

@products_bp.route('/<int:id>', methods=['DELETE'])
def delete_product(id):
    product = Product.query.get_or_404(id)
    db.session.delete(product)
    db.session.commit()
    return jsonify({'message': 'Produkt usunięty'}), 200