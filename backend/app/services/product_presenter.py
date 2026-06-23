from app.models.product import Product


def product_to_dict(product: Product) -> dict:
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
    }
