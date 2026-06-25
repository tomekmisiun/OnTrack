from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.domain.product_normalize import normalize_product_name
from app.models.product import Product
from app.models.recipe import RecipeIngredient
from app.services.product_presenter import product_to_dict
from app.services.user_preferences import catalog_lang_for_user, market_code_for_user

MAX_NUM = 99999
MAX_NAME = 50
MAX_KCAL = 9999
MAX_MACRO = 100
MAX_PRICE = 9999
DEFAULT_LIST_LIMIT = 20
MAX_LIST_LIMIT = 100


class ProductServiceError(Exception):
    def __init__(self, message: str, status_code: int):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def validate_product_data(data: dict, require_all: bool = True) -> str | None:
    if require_all and not all(k in data for k in ("name", "package_weight", "price")):
        return "Required fields: name, package_weight, price"
    if "name" in data:
        name = str(data["name"]).strip()
        if not name:
            return "Product name cannot be empty"
        if len(name) > MAX_NAME:
            return f"Product name max {MAX_NAME} characters"
    if "package_weight" in data:
        try:
            w = float(data["package_weight"])
        except (TypeError, ValueError):
            return "Invalid package weight"
        if w <= 0 or w > MAX_NUM:
            return f"Package weight must be between 0 and {MAX_NUM}"
    if "price" in data:
        try:
            p = float(data["price"])
        except (TypeError, ValueError):
            return "Invalid price"
        if p < 0 or p > MAX_PRICE:
            return f"Price must be between 0 and {MAX_PRICE}"
    if "kcal" in data and data["kcal"] is not None:
        try:
            v = float(data["kcal"])
        except (TypeError, ValueError):
            return "Invalid kcal value"
        if v < 0 or v > MAX_KCAL:
            return f"Kcal must be between 0 and {MAX_KCAL}"
    for macro in ("protein", "fat", "carbs"):
        if macro in data and data[macro] is not None:
            try:
                v = float(data[macro])
            except (TypeError, ValueError):
                return f"Invalid {macro} value"
            if v < 0 or v > MAX_MACRO:
                return f"{macro} must be between 0 and {MAX_MACRO}"
    return None


def _visible_products_query(session: Session, user_id: int, market_code: str):
    catalog_lang = catalog_lang_for_user(session, user_id)
    overridden_system_ids = (
        session.query(Product.base_product_id)
        .filter(
            Product.user_id == user_id,
            Product.market_code == market_code,
            Product.base_product_id.isnot(None),
        )
        .scalar_subquery()
    )
    return session.query(Product).filter(
        Product.market_code == market_code,
        or_(
            and_(Product.user_id == user_id, Product.lang == catalog_lang),
            and_(
                Product.user_id.is_(None),
                Product.source == "system",
                ~Product.id.in_(overridden_system_ids),
            ),
        ),
    )


def resolve_visible_product(
    session: Session, user_id: int, product_id: int
) -> Product | None:
    market_code = market_code_for_user(session, user_id)
    return (
        _visible_products_query(session, user_id, market_code)
        .filter(Product.id == product_id)
        .first()
    )


def _get_own_product(session: Session, user_id: int, product_id: int) -> Product:
    market_code = market_code_for_user(session, user_id)
    catalog_lang = catalog_lang_for_user(session, user_id)
    product = session.get(Product, product_id)
    if not product:
        raise ProductServiceError("Product not found", 404)
    if product.source == "system" and product.user_id is None:
        raise ProductServiceError("System catalog products cannot be modified", 403)
    if product.user_id != user_id or product.market_code != market_code:
        raise ProductServiceError("Product not found", 404)
    if product.lang != catalog_lang:
        raise ProductServiceError("Product not found", 404)
    return product


def list_products(
    session: Session,
    user_id: int,
    *,
    q: str | None = None,
    limit: int = DEFAULT_LIST_LIMIT,
    offset: int = 0,
) -> dict:
    if limit < 1:
        raise ProductServiceError("limit must be at least 1", 400)
    if limit > MAX_LIST_LIMIT:
        raise ProductServiceError(f"limit must be at most {MAX_LIST_LIMIT}", 400)
    if offset < 0:
        raise ProductServiceError("offset must be non-negative", 400)

    market_code = market_code_for_user(session, user_id)
    query = _visible_products_query(session, user_id, market_code)

    if q:
        term = f"%{normalize_product_name(q)}%"
        query = query.filter(Product.normalized_name.ilike(term))

    total = query.count()
    rows = query.order_by(Product.name).offset(offset).limit(limit).all()
    return {
        "items": [product_to_dict(p, viewer_user_id=user_id) for p in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


def create_product(session: Session, user_id: int, data: dict) -> dict:
    err = validate_product_data(data, require_all=True)
    if err:
        raise ProductServiceError(err, 400)

    market_code = market_code_for_user(session, user_id)
    catalog_lang = catalog_lang_for_user(session, user_id)
    product = Product(
        user_id=user_id,
        source="user",
        normalized_name=normalize_product_name(str(data["name"])),
        name=str(data["name"]).strip()[:MAX_NAME],
        package_weight=float(data["package_weight"]),
        price=float(data["price"]),
        unit=str(data.get("unit", "g"))[:10],
        kcal=float(data["kcal"]) if data.get("kcal") is not None else None,
        protein=float(data["protein"]) if data.get("protein") is not None else None,
        fat=float(data["fat"]) if data.get("fat") is not None else None,
        carbs=float(data["carbs"]) if data.get("carbs") is not None else None,
        sold_by_weight=bool(data.get("sold_by_weight", False)),
        lang=catalog_lang,
        market_code=market_code,
    )
    session.add(product)
    session.commit()
    session.refresh(product)
    return product_to_dict(product, viewer_user_id=user_id)


def customize_product(session: Session, user_id: int, product_id: int, data: dict) -> dict:
    market_code = market_code_for_user(session, user_id)
    catalog_lang = catalog_lang_for_user(session, user_id)
    system = session.get(Product, product_id)
    if (
        not system
        or system.source != "system"
        or system.user_id is not None
        or system.market_code != market_code
    ):
        raise ProductServiceError("Product not found or not a system catalog item", 404)

    existing = (
        session.query(Product)
        .filter_by(user_id=user_id, market_code=market_code, base_product_id=system.id)
        .first()
    )
    if existing:
        return update_product(session, user_id, existing.id, data)

    err = validate_product_data(data, require_all=False)
    if err:
        raise ProductServiceError(err, 400)

    product = Product(
        user_id=user_id,
        source="user",
        base_product_id=system.id,
        normalized_name=system.normalized_name,
        name=system.name,
        package_weight=system.package_weight,
        price=system.price,
        unit=system.unit,
        kcal=system.kcal,
        protein=system.protein,
        fat=system.fat,
        carbs=system.carbs,
        sold_by_weight=system.sold_by_weight,
        lang=catalog_lang,
        market_code=market_code,
    )
    if "name" in data:
        product.name = str(data["name"]).strip()[:MAX_NAME]
        product.normalized_name = normalize_product_name(product.name)
    if "package_weight" in data:
        product.package_weight = float(data["package_weight"])
    if "price" in data:
        product.price = float(data["price"])
    if "unit" in data:
        product.unit = str(data["unit"])[:10]
    if "sold_by_weight" in data:
        product.sold_by_weight = bool(data["sold_by_weight"])
    for macro in ("kcal", "protein", "fat", "carbs"):
        if macro in data:
            setattr(product, macro, float(data[macro]) if data[macro] is not None else None)

    session.add(product)
    session.commit()
    session.refresh(product)
    return product_to_dict(product, viewer_user_id=user_id)


def update_product(session: Session, user_id: int, product_id: int, data: dict) -> dict:
    product = _get_own_product(session, user_id, product_id)
    err = validate_product_data(data, require_all=False)
    if err:
        raise ProductServiceError(err, 400)

    if "name" in data:
        product.name = str(data["name"]).strip()[:MAX_NAME]
        product.normalized_name = normalize_product_name(product.name)
    if "package_weight" in data:
        product.package_weight = float(data["package_weight"])
    if "price" in data:
        product.price = float(data["price"])
    if "unit" in data:
        product.unit = str(data["unit"])[:10]
    if "sold_by_weight" in data:
        product.sold_by_weight = bool(data["sold_by_weight"])
    for macro in ("kcal", "protein", "fat", "carbs"):
        if macro in data:
            setattr(product, macro, float(data[macro]) if data[macro] is not None else None)

    session.commit()
    session.refresh(product)
    return product_to_dict(product, viewer_user_id=user_id)


def delete_product(session: Session, user_id: int, product_id: int) -> None:
    product = _get_own_product(session, user_id, product_id)
    in_recipes = (
        session.query(RecipeIngredient).filter_by(product_id=product.id).count()
    )
    if in_recipes > 0:
        raise ProductServiceError(
            "Product is used in recipes and cannot be deleted", 409
        )
    session.delete(product)
    session.commit()


def delete_all_products(session: Session, user_id: int) -> int:
    market_code = market_code_for_user(session, user_id)
    count = (
        session.query(Product)
        .filter_by(user_id=user_id, market_code=market_code)
        .delete()
    )
    session.commit()
    return count
