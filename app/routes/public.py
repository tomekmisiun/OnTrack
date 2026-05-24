from flask import Blueprint, jsonify, request

from app.dish_compare_data import load_dish_compare

public_bp = Blueprint("public", __name__)


@public_bp.route("/dish-compare", methods=["GET"])
def dish_compare():
    lang = request.args.get("lang", "pl")
    if lang not in ("pl", "en"):
        lang = "pl"
    try:
        return jsonify(load_dish_compare(lang)), 200
    except FileNotFoundError as exc:
        return jsonify({"error": str(exc)}), 503
