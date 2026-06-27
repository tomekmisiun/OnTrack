from __future__ import annotations

from app.models.product import Product
from app.services.catalog_resolver import ResolvedProduct, resolve_product


def product_to_dict(
    product: Product,
    *,
    viewer_user_id: int | None = None,
    locale: str = "pl",
    market_code: str = "PL",
    resolved: ResolvedProduct | None = None,
) -> dict:
    view = resolved or resolve_product(product, locale=locale, market_code=market_code)
    is_system = product.source == "system" and product.user_id is None
    is_owner = viewer_user_id is not None and product.user_id == viewer_user_id
    return {
        "id": product.id,
        "catalog_key": product.catalog_key,
        "name": view.name,
        "package_weight": view.package_weight,
        "price": view.price,
        "currency": view.currency,
        "has_price": view.has_price,
        "unit": view.unit,
        "kcal": product.kcal,
        "protein": product.protein,
        "fat": product.fat,
        "carbs": product.carbs,
        "sold_by_weight": view.sold_by_weight,
        "source": product.source,
        "is_system": is_system,
        "is_editable": is_owner and not is_system,
        "base_product_id": product.base_product_id,
    }
