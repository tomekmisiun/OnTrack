from __future__ import annotations

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, joinedload

from app.domain.market import currency_for_market
from app.domain.product_normalize import normalize_product_name
from app.models.product import Product
from app.models.product_market_price import ProductMarketPrice
from app.models.recipe import RecipeIngredient
from app.services.product_presenter import product_to_dict
from app.services.user_preferences import market_code_for_user, ui_locale_for_user

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


def _product_load_options():
    return (
        joinedload(Product.translations),
        joinedload(Product.market_prices),
    )


def _own_products_query(session: Session, user_id: int):
    return (
        session.query(Product)
        .options(*_product_load_options())
        .filter(Product.user_id == user_id)
    )


def _visible_products_query(session: Session, user_id: int):
    overridden_system_ids = (
        session.query(Product.base_product_id)
        .filter(
            Product.user_id == user_id,
            Product.base_product_id.isnot(None),
        )
        .scalar_subquery()
    )
    return (
        session.query(Product)
        .options(*_product_load_options())
        .filter(
            or_(
                Product.user_id == user_id,
                and_(
                    Product.user_id.is_(None),
                    Product.source == "system",
                    ~Product.id.in_(overridden_system_ids),
                ),
            )
        )
    )


def resolve_visible_product(
    session: Session, user_id: int, product_id: int
) -> Product | None:
    return (
        _visible_products_query(session, user_id)
        .filter(Product.id == product_id)
        .first()
    )


def _get_own_product(session: Session, user_id: int, product_id: int) -> Product:
    product = (
        session.query(Product)
        .options(*_product_load_options())
        .filter(Product.id == product_id)
        .first()
    )
    if not product:
        raise ProductServiceError("Product not found", 404)
    if product.source == "system" and product.user_id is None:
        raise ProductServiceError("System catalog products cannot be modified", 403)
    if product.user_id != user_id:
        raise ProductServiceError("Product not found", 404)
    return product


def _upsert_user_market_price(
    product: Product,
    *,
    market_code: str,
    price: float,
    package_weight: float,
    unit: str,
    sold_by_weight: bool,
) -> None:
    currency = currency_for_market(market_code)
    for row in product.market_prices:
        if row.market_code == market_code:
            row.amount = price
            row.currency = currency
            row.package_weight = package_weight
            row.unit = unit
            row.sold_by_weight = sold_by_weight
            return
    product.market_prices.append(
        ProductMarketPrice(
            product=product,
            market_code=market_code,
            amount=price,
            currency=currency,
            package_weight=package_weight,
            unit=unit[:10],
            sold_by_weight=sold_by_weight,
        )
    )


def list_products(
    session: Session,
    user_id: int,
    *,
    q: str | None = None,
    limit: int = DEFAULT_LIST_LIMIT,
    offset: int = 0,
    own_only: bool = False,
) -> dict:
    if limit < 1:
        raise ProductServiceError("limit must be at least 1", 400)
    if limit > MAX_LIST_LIMIT:
        raise ProductServiceError(f"limit must be at most {MAX_LIST_LIMIT}", 400)
    if offset < 0:
        raise ProductServiceError("offset must be non-negative", 400)

    locale = ui_locale_for_user(session, user_id)
    market_code = market_code_for_user(session, user_id)
    query = (
        _own_products_query(session, user_id)
        if own_only
        else _visible_products_query(session, user_id)
    )

    if q:
        term = f"%{normalize_product_name(q)}%"
        query = query.filter(Product.normalized_name.ilike(term))

    total = query.count()
    rows = (
        query.order_by(Product.sort_index.asc().nulls_last(), Product.id.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {
        "items": [
            product_to_dict(p, viewer_user_id=user_id, locale=locale, market_code=market_code)
            for p in rows
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


def create_product(session: Session, user_id: int, data: dict) -> dict:
    err = validate_product_data(data, require_all=True)
    if err:
        raise ProductServiceError(err, 400)

    market_code = market_code_for_user(session, user_id)
    locale = ui_locale_for_user(session, user_id)
    name = str(data["name"]).strip()[:MAX_NAME]
    product = Product(
        user_id=user_id,
        source="user",
        user_name=name,
        normalized_name=normalize_product_name(name),
        kcal=float(data["kcal"]) if data.get("kcal") is not None else 0,
        protein=float(data["protein"]) if data.get("protein") is not None else 0,
        fat=float(data["fat"]) if data.get("fat") is not None else 0,
        carbs=float(data["carbs"]) if data.get("carbs") is not None else 0,
    )
    _upsert_user_market_price(
        product,
        market_code=market_code,
        price=float(data["price"]),
        package_weight=float(data["package_weight"]),
        unit=str(data.get("unit", "g")),
        sold_by_weight=bool(data.get("sold_by_weight", False)),
    )
    session.add(product)
    session.commit()
    session.refresh(product)
    return product_to_dict(product, viewer_user_id=user_id, locale=locale, market_code=market_code)


def customize_product(session: Session, user_id: int, product_id: int, data: dict) -> dict:
    market_code = market_code_for_user(session, user_id)
    locale = ui_locale_for_user(session, user_id)
    system = (
        session.query(Product)
        .options(*_product_load_options())
        .filter(
            Product.id == product_id,
            Product.source == "system",
            Product.user_id.is_(None),
        )
        .first()
    )
    if not system:
        raise ProductServiceError("Product not found or not a system catalog item", 404)

    existing = (
        session.query(Product)
        .options(*_product_load_options())
        .filter_by(user_id=user_id, base_product_id=system.id)
        .first()
    )
    if existing:
        return update_product(session, user_id, existing.id, data)

    err = validate_product_data(data, require_all=False)
    if err:
        raise ProductServiceError(err, 400)

    from app.services.catalog_resolver import resolve_product

    base_view = resolve_product(system, locale=locale, market_code=market_code)
    product = Product(
        user_id=user_id,
        source="user",
        base_product_id=system.id,
        user_name=base_view.name,
        normalized_name=system.normalized_name,
        kcal=system.kcal,
        protein=system.protein,
        fat=system.fat,
        carbs=system.carbs,
    )
    if base_view.has_price:
        _upsert_user_market_price(
            product,
            market_code=market_code,
            price=base_view.price or 0,
            package_weight=base_view.package_weight or 100,
            unit=base_view.unit or "g",
            sold_by_weight=base_view.sold_by_weight,
        )
    if "name" in data:
        product.user_name = str(data["name"]).strip()[:MAX_NAME]
        product.normalized_name = normalize_product_name(product.user_name)
    if "package_weight" in data or "price" in data or "unit" in data or "sold_by_weight" in data:
        current_price = base_view.price or 0
        current_pkg = base_view.package_weight or 100
        current_unit = base_view.unit or "g"
        current_sbw = base_view.sold_by_weight
        _upsert_user_market_price(
            product,
            market_code=market_code,
            price=float(data["price"]) if "price" in data else current_price,
            package_weight=float(data["package_weight"])
            if "package_weight" in data
            else current_pkg,
            unit=str(data["unit"])[:10] if "unit" in data else current_unit,
            sold_by_weight=bool(data["sold_by_weight"])
            if "sold_by_weight" in data
            else current_sbw,
        )
    for macro in ("kcal", "protein", "fat", "carbs"):
        if macro in data and data[macro] is not None:
            setattr(product, macro, float(data[macro]))

    session.add(product)
    session.commit()
    session.refresh(product)
    return product_to_dict(product, viewer_user_id=user_id, locale=locale, market_code=market_code)


def update_product(session: Session, user_id: int, product_id: int, data: dict) -> dict:
    product = _get_own_product(session, user_id, product_id)
    err = validate_product_data(data, require_all=False)
    if err:
        raise ProductServiceError(err, 400)

    market_code = market_code_for_user(session, user_id)
    locale = ui_locale_for_user(session, user_id)

    if "name" in data:
        product.user_name = str(data["name"]).strip()[:MAX_NAME]
        product.normalized_name = normalize_product_name(product.user_name)
    if any(k in data for k in ("package_weight", "price", "unit", "sold_by_weight")):
        existing_row = next(
            (row for row in product.market_prices if row.market_code == market_code),
            None,
        )
        _upsert_user_market_price(
            product,
            market_code=market_code,
            price=float(data["price"]) if "price" in data else (existing_row.amount if existing_row else 0),
            package_weight=float(data["package_weight"])
            if "package_weight" in data
            else (existing_row.package_weight if existing_row else 100),
            unit=str(data["unit"])[:10] if "unit" in data else (existing_row.unit if existing_row else "g"),
            sold_by_weight=bool(data["sold_by_weight"])
            if "sold_by_weight" in data
            else (existing_row.sold_by_weight if existing_row else False),
        )
    for macro in ("kcal", "protein", "fat", "carbs"):
        if macro in data and data[macro] is not None:
            setattr(product, macro, float(data[macro]))

    session.commit()
    session.refresh(product)
    return product_to_dict(product, viewer_user_id=user_id, locale=locale, market_code=market_code)


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
    count = session.query(Product).filter_by(user_id=user_id).delete()
    session.commit()
    return count
