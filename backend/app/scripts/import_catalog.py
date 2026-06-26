"""Idempotent import of global product and recipe catalog into PostgreSQL.

Reads generated market files only — never DB users, never raw snapshots.

Usage:
  uv run python -m app.scripts.import_catalog
  uv run python -m app.scripts.import_catalog --market PL
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.core.catalog_data import (
    MARKETS,
    generated_products_path,
    generated_recipes_path,
    read_generated_items,
)
from app.domain.product_normalize import normalize_product_name
from app.models.product import Product
from app.models.recipe import Recipe, RecipeIngredient


@dataclass
class CatalogImportReport:
    products_created: int = 0
    products_updated: int = 0
    recipes_created: int = 0
    recipes_updated: int = 0
    recipe_ingredients_linked: int = 0
    recipe_ingredients_skipped: int = 0
    rejected: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "products_created": self.products_created,
            "products_updated": self.products_updated,
            "recipes_created": self.recipes_created,
            "recipes_updated": self.recipes_updated,
            "recipe_ingredients_linked": self.recipe_ingredients_linked,
            "recipe_ingredients_skipped": self.recipe_ingredients_skipped,
            "rejected": self.rejected,
        }


def catalog_key_for_product(market_code: str, sort_index: int, stable_key: str) -> str:
    safe = (stable_key or "item").strip()[:80]
    return f"catalog:{market_code.lower()}:{sort_index:05d}:{safe}"


def catalog_key_for_recipe(market_code: str, sort_index: int, stable_key: str) -> str:
    safe = (stable_key or "item").strip()[:80]
    return f"recipe:{market_code.lower()}:{sort_index:05d}:{safe}"


def _locale_for_market(market_code: str) -> str:
    return "en" if market_code == "GB" else "pl"


def import_products_for_market(session: Session, market_code: str, report: CatalogImportReport) -> None:
    path = generated_products_path(market_code)
    if not path.is_file():
        report.rejected.append(f"missing generated products for {market_code}")
        return
    _, rows = read_generated_items(path)
    locale = _locale_for_market(market_code)

    system_by_key: dict[str, Product] = {
        p.catalog_key: p
        for p in session.query(Product)
        .filter_by(source="system", market_code=market_code)
        .filter(Product.catalog_key.isnot(None))
        .all()
        if p.catalog_key
    }

    for idx, row in enumerate(rows):
        name = (row.get("name") or "").strip()
        if not name:
            report.rejected.append(f"{market_code} product[{idx}]: empty name")
            continue
        sort_index = int(row.get("sort_index", idx))
        stable_key = (row.get("stable_key") or normalize_product_name(name).replace(" ", "-")).strip()
        key = catalog_key_for_product(market_code, sort_index, stable_key)
        payload = {
            "name": name[:255],
            "normalized_name": normalize_product_name(name),
            "price": float(row.get("price") or 0),
            "package_weight": float(row.get("package_weight") or 100),
            "unit": (row.get("unit") or "g")[:10],
            "sold_by_weight": bool(row.get("sold_by_weight", False)),
            "kcal": row.get("kcal"),
            "protein": row.get("protein"),
            "fat": row.get("fat"),
            "carbs": row.get("carbs"),
            "lang": locale,
            "market_code": market_code,
            "user_id": None,
            "source": "system",
            "catalog_key": key,
        }
        existing = system_by_key.get(key)
        if existing:
            changed = False
            for field_name, value in payload.items():
                if field_name in ("user_id", "source", "catalog_key"):
                    continue
                if getattr(existing, field_name) != value:
                    setattr(existing, field_name, value)
                    changed = True
            if changed:
                report.products_updated += 1
        else:
            product = Product(**payload)
            session.add(product)
            session.flush()
            system_by_key[key] = product
            report.products_created += 1

    _purge_orphan_system_products(session, market_code, set(system_by_key.keys()), report)


def _relink_recipe_ingredients(session: Session, from_id: int, to_id: int) -> None:
    for ing in session.query(RecipeIngredient).filter_by(product_id=from_id):
        ing.product_id = to_id


def _purge_orphan_system_products(
    session: Session,
    market_code: str,
    active_keys: set[str],
    report: CatalogImportReport,
) -> None:
    system_rows = (
        session.query(Product)
        .filter_by(source="system", market_code=market_code)
        .filter(Product.user_id.is_(None))
        .all()
    )
    canonical_by_name: dict[str, Product] = {}
    for product in system_rows:
        if product.catalog_key in active_keys:
            canonical_by_name.setdefault(product.normalized_name, product)

    for product in system_rows:
        if product.catalog_key in active_keys:
            continue
        replacement = canonical_by_name.get(product.normalized_name)
        if replacement and replacement.id != product.id:
            _relink_recipe_ingredients(session, product.id, replacement.id)
        refs = session.query(RecipeIngredient).filter_by(product_id=product.id).count()
        if refs:
            continue
        session.delete(product)
        report.rejected.append(f"purged orphan product {product.catalog_key!r}")


def _product_name_map(session: Session, market_code: str) -> dict[str, int]:
    locale = _locale_for_market(market_code)
    out: dict[str, int] = {}
    for product in session.query(Product).filter(
        Product.market_code == market_code,
        Product.lang == locale,
    ):
        if product.source == "system" and product.user_id is None:
            out[product.name.lower()] = product.id
        elif product.user_id is not None:
            out[product.name.lower()] = product.id
    return out


def import_recipes_for_market(session: Session, market_code: str, report: CatalogImportReport) -> None:
    path = generated_recipes_path(market_code)
    if not path.is_file():
        report.rejected.append(f"missing generated recipes for {market_code}")
        return
    _, rows = read_generated_items(path)
    locale = _locale_for_market(market_code)
    product_map = _product_name_map(session, market_code)

    system_by_key: dict[str, Recipe] = {
        r.catalog_key: r
        for r in session.query(Recipe)
        .filter_by(source="system", market_code=market_code)
        .filter(Recipe.catalog_key.isnot(None))
        .all()
        if r.catalog_key
    }

    for row in rows:
        name = (row.get("name") or "").strip()
        if not name:
            continue
        source_url = (row.get("source_url") or "").strip() or None
        sort_index = int(row.get("sort_index", 0))
        stable_key = (row.get("stable_key") or (source_url or name)).strip()
        key = catalog_key_for_recipe(market_code, sort_index, stable_key)
        raw_cat = row.get("category") or ""
        category = {"snacks": "snack", "desserts": "dessert"}.get(raw_cat, raw_cat) or None

        existing = system_by_key.get(key)
        if existing:
            recipe = existing
            recipe.name = name
            recipe.notes = row.get("notes")
            recipe.image_url = row.get("image_url")
            recipe.source_url = source_url
            recipe.category = category
            recipe.lang = locale
            recipe.market_code = market_code
            session.query(RecipeIngredient).filter_by(recipe_id=recipe.id).delete()
            report.recipes_updated += 1
        else:
            recipe = Recipe(
                user_id=None,
                source="system",
                catalog_key=key,
                name=name,
                notes=row.get("notes"),
                image_url=row.get("image_url"),
                source_url=source_url,
                category=category,
                lang=locale,
                market_code=market_code,
                kcal_100g=row.get("kcal_100g"),
                protein_100g=row.get("protein_100g"),
                fat_100g=row.get("fat_100g"),
                carbs_100g=row.get("carbs_100g"),
            )
            session.add(recipe)
            session.flush()
            system_by_key[key] = recipe
            report.recipes_created += 1

        for ing in row.get("ingredients") or []:
            pname = (ing.get("product_name") or "").strip().lower()
            weight = float(ing.get("weight") or 0)
            product_id = product_map.get(pname)
            if not product_id or weight <= 0:
                report.recipe_ingredients_skipped += 1
                continue
            session.add(
                RecipeIngredient(recipe_id=recipe.id, product_id=product_id, weight=weight)
            )
            report.recipe_ingredients_linked += 1

    active_recipe_keys = set(system_by_key.keys())
    for recipe in (
        session.query(Recipe)
        .filter_by(source="system", market_code=market_code)
        .filter(Recipe.user_id.is_(None))
        .all()
    ):
        if recipe.catalog_key not in active_recipe_keys:
            session.query(RecipeIngredient).filter_by(recipe_id=recipe.id).delete()
            session.delete(recipe)
            report.rejected.append(f"purged orphan recipe {recipe.catalog_key!r}")


def import_catalog(session: Session, markets: tuple[str, ...] = MARKETS) -> CatalogImportReport:
    report = CatalogImportReport()
    try:
        for market in markets:
            import_products_for_market(session, market, report)
            import_recipes_for_market(session, market, report)
        session.commit()
    except Exception:
        session.rollback()
        raise
    return report


def sync_global_catalog(session: Session) -> CatalogImportReport:
    """Reconcile DB system catalog with generated JSON (idempotent, purges orphans)."""
    return import_catalog(session)


def ensure_global_catalog_loaded(session: Session) -> CatalogImportReport | None:
    """Import or refresh global catalog on API startup."""
    return sync_global_catalog(session)


def main() -> None:
    from app.db.session import get_session_factory

    parser = argparse.ArgumentParser(description="Import global catalog from generated JSON")
    parser.add_argument("--market", choices=MARKETS, help="Import single market (default: all)")
    args = parser.parse_args()
    markets: tuple[str, ...] = (args.market,) if args.market else MARKETS

    session = get_session_factory()()
    try:
        report = import_catalog(session, markets)
        print(json.dumps(report.as_dict(), indent=2))
    finally:
        session.close()


if __name__ == "__main__":
    main()
