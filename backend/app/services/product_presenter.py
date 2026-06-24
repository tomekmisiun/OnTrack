from app.models.product import Product


def product_to_dict(product: Product, *, viewer_user_id: int | None = None) -> dict:
    is_system = product.source == "system" and product.user_id is None
    is_owner = viewer_user_id is not None and product.user_id == viewer_user_id
    return {
        "id": product.id,
        "name": product.name,
        "package_weight": product.package_weight,
        "price": product.price,
        "unit": product.unit,
        "kcal": product.kcal,
        "protein": product.protein,
        "fat": product.fat,
        "carbs": product.carbs,
        "sold_by_weight": bool(product.sold_by_weight),
        "lang": product.lang or "pl",
        "source": product.source,
        "is_system": is_system,
        "is_editable": is_owner and not is_system,
        "base_product_id": product.base_product_id,
    }
