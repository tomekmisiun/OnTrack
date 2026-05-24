from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app.services.macro_lookup import lookup_macros
from app.utils import current_user_lang

nutrition_bp = Blueprint('nutrition', __name__)


@nutrition_bp.route('/lookup', methods=['GET'])
@jwt_required()
def lookup():
    name = (request.args.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Product name is required'}), 400

    lang = request.args.get('lang') or current_user_lang()
    result = lookup_macros(name, lang)
    if result.get('found'):
        return jsonify(result)
    return jsonify(result), 404
