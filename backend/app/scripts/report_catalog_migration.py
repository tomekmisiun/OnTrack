"""Report catalog DB state for pre/post migration review (read-only)."""

from __future__ import annotations

import argparse
import json

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import get_session_factory
from app.models.product import Product
from app.models.recipe import Recipe


def report(session: Session) -> dict:
    product_rows = (
        session.query(Product.source, Product.market_code, func.count(Product.id))
        .group_by(Product.source, Product.market_code)
        .all()
    )
    recipe_rows = (
        session.query(Recipe.source, Recipe.market_code, func.count(Recipe.id))
        .group_by(Recipe.source, Recipe.market_code)
        .all()
    )
    ambiguous_products = (
        session.query(Product.normalized_name, Product.market_code, func.count(Product.id))
        .filter(Product.user_id.isnot(None))
        .group_by(Product.normalized_name, Product.market_code)
        .having(func.count(Product.id) > 1)
        .count()
    )

    return {
        "products": [
            {"source": s, "market_code": m, "count": c} for s, m, c in product_rows
        ],
        "recipes": [
            {"source": s, "market_code": m, "count": c} for s, m, c in recipe_rows
        ],
        "user_owned_recipes": session.query(Recipe)
        .filter(Recipe.user_id.isnot(None), Recipe.source == "user")
        .count(),
        "system_recipes": session.query(Recipe)
        .filter(Recipe.user_id.is_(None), Recipe.source == "system")
        .count(),
        "ambiguous_private_product_name_groups": ambiguous_products,
        "notes": [
            "User recipe rows may include historical per-user seed copies.",
            "Do not delete rows whose origin is unclear — review manually.",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Report catalog DB state for migration review")
    parser.parse_args()
    session = get_session_factory()()
    try:
        print(json.dumps(report(session), indent=2))
    finally:
        session.close()


if __name__ == "__main__":
    main()
