"""Idempotent import of global product and recipe catalog from canonical JSON.

Usage:
  uv run python -m app.scripts.import_catalog
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.orm import Session

from app.core.catalog_data import (
    canonical_products_path,
    canonical_recipes_path,
    load_json_list,
)
from app.domain.catalog_seed import slug_catalog_key
from app.domain.market import currency_for_market
from app.domain.product_normalize import normalize_product_name
from app.models.product import Product
from app.models.product_market_price import ProductMarketPrice
from app.models.product_translation import ProductTranslation
from app.models.recipe import Recipe, RecipeIngredient
from app.models.recipe_translation import RecipeTranslation

SUPPORTED_LOCALES = ("pl", "en")
SUPPORTED_MARKETS = ("PL", "GB")


@dataclass
class CatalogImportReport:
    products_created: int = 0
    products_updated: int = 0
    recipes_created: int = 0
    recipes_updated: int = 0
    recipe_ingredients_linked: int = 0
    recipe_ingredients_skipped: int = 0
    warnings: list[str] = field(default_factory=list)
    rejected: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "products_created": self.products_created,
            "products_updated": self.products_updated,
            "recipes_created": self.recipes_created,
            "recipes_updated": self.recipes_updated,
            "recipe_ingredients_linked": self.recipe_ingredients_linked,
            "recipe_ingredients_skipped": self.recipe_ingredients_skipped,
            "warnings": self.warnings,
            "rejected": self.rejected,
        }


def _recipe_catalog_key(entry: dict[str, Any]) -> str:
    source_url = (entry.get("source_url") or "").strip()
    names = entry.get("names") or {}
    fallback = (names.get("pl") or names.get("en") or "").strip()
    return (entry.get("key") or slug_catalog_key(source_url or fallback)).strip()


def _load_system_products(session: Session) -> dict[str, Product]:
    return {
        p.catalog_key: p
        for p in session.query(Product)
        .filter(Product.user_id.is_(None), Product.source == "system")
        .filter(Product.catalog_key.isnot(None))
        .all()
        if p.catalog_key
    }


def _load_system_recipes(session: Session) -> dict[str, Recipe]:
    return {
        r.catalog_key: r
        for r in session.query(Recipe)
        .filter(Recipe.user_id.is_(None), Recipe.source == "system")
        .filter(Recipe.catalog_key.isnot(None))
        .all()
        if r.catalog_key
    }


def _upsert_translation(
    rows: list[ProductTranslation | RecipeTranslation],
    *,
    locale: str,
    name: str,
    notes: str | None = None,
    model_cls: type,
    parent_kw: str,
    parent_id: int,
) -> None:
    for row in rows:
        if row.locale == locale:
            row.name = name
            if isinstance(row, RecipeTranslation):
                row.notes = notes
            return
    payload = {"locale": locale, "name": name, parent_kw: parent_id}
    if model_cls is RecipeTranslation:
        payload["notes"] = notes
    rows.append(model_cls(**payload))


def _upsert_market_price(
    product: Product,
    *,
    market_code: str,
    market: dict[str, Any],
    report: CatalogImportReport,
) -> None:
    amount = float(market.get("price") or 0)
    currency = currency_for_market(market_code)
    package_weight = float(market.get("package_weight") or 100)
    unit = (market.get("unit") or "g")[:10]
    sold_by_weight = bool(market.get("sold_by_weight", False))

    for row in product.market_prices:
        if row.market_code == market_code:
            row.amount = amount
            row.currency = currency
            row.package_weight = package_weight
            row.unit = unit
            row.sold_by_weight = sold_by_weight
            return

    product.market_prices.append(
        ProductMarketPrice(
            product=product,
            market_code=market_code,
            amount=amount,
            currency=currency,
            package_weight=package_weight,
            unit=unit,
            sold_by_weight=sold_by_weight,
        )
    )


def import_products_from_canonical(session: Session, report: CatalogImportReport) -> dict[str, int]:
    path = canonical_products_path()
    if not path.is_file():
        report.rejected.append(f"missing canonical products at {path}")
        return {}

    rows = load_json_list(path)
    system_by_key = _load_system_products(session)
    product_id_by_key: dict[str, int] = {}

    for sort_index, entry in enumerate(rows):
        catalog_key = (entry.get("key") or "").strip()
        if not catalog_key:
            report.rejected.append(f"product[{sort_index}]: missing key")
            continue

        names = entry.get("names") or {}
        macros = entry.get("macros") or {}
        markets = entry.get("markets") or {}

        missing_locales = [loc for loc in SUPPORTED_LOCALES if not (names.get(loc) or "").strip()]
        if missing_locales:
            report.warnings.append(
                f"product {catalog_key!r}: missing names for {', '.join(missing_locales)}"
            )

        missing_markets = [m for m in SUPPORTED_MARKETS if m not in markets]
        if missing_markets:
            report.warnings.append(
                f"product {catalog_key!r}: missing market prices for {', '.join(missing_markets)}"
            )

        primary_name = (names.get("pl") or names.get("en") or catalog_key).strip()
        payload = {
            "user_id": None,
            "source": "system",
            "catalog_key": catalog_key,
            "normalized_name": normalize_product_name(primary_name),
            "kcal": float(macros.get("kcal") or 0),
            "protein": float(macros.get("protein") or 0),
            "fat": float(macros.get("fat") or 0),
            "carbs": float(macros.get("carbs") or 0),
            "sort_index": sort_index,
        }

        existing = system_by_key.get(catalog_key)
        if existing:
            product = existing
            changed = False
            for field_name, value in payload.items():
                if getattr(product, field_name) != value:
                    setattr(product, field_name, value)
                    changed = True
            if changed:
                report.products_updated += 1
        else:
            product = Product(**payload)
            session.add(product)
            session.flush()
            system_by_key[catalog_key] = product
            report.products_created += 1

        for locale in SUPPORTED_LOCALES:
            name = (names.get(locale) or "").strip()
            if not name:
                continue
            _upsert_translation(
                product.translations,
                locale=locale,
                name=name[:255],
                model_cls=ProductTranslation,
                parent_kw="product_id",
                parent_id=product.id,
            )

        for market_code in SUPPORTED_MARKETS:
            market = markets.get(market_code)
            if not market:
                continue
            _upsert_market_price(product, market_code=market_code, market=market, report=report)

        product_id_by_key[catalog_key] = product.id

    active_keys = set(system_by_key.keys())
    for product in (
        session.query(Product)
        .filter(Product.user_id.is_(None), Product.source == "system")
        .all()
    ):
        if product.catalog_key not in active_keys:
            session.query(RecipeIngredient).filter_by(product_id=product.id).delete()
            session.delete(product)
            report.rejected.append(f"purged orphan product {product.catalog_key!r}")

    return product_id_by_key


def import_recipes_from_canonical(
    session: Session,
    product_id_by_key: dict[str, int],
    report: CatalogImportReport,
) -> None:
    path = canonical_recipes_path()
    if not path.is_file():
        report.rejected.append(f"missing canonical recipes at {path}")
        return

    rows = load_json_list(path)
    system_by_key = _load_system_recipes(session)

    for entry in rows:
        catalog_key = _recipe_catalog_key(entry)
        names = entry.get("names") or {}
        if not catalog_key:
            continue

        missing_locales = [loc for loc in SUPPORTED_LOCALES if not (names.get(loc) or "").strip()]
        if missing_locales:
            report.warnings.append(
                f"recipe {catalog_key!r}: missing names for {', '.join(missing_locales)}"
            )

        source_url = (entry.get("source_url") or "").strip() or None
        raw_cat = entry.get("category") or ""
        category = {"snacks": "snack", "desserts": "dessert"}.get(raw_cat, raw_cat) or "other"

        existing = system_by_key.get(catalog_key)
        if existing:
            recipe = existing
            recipe.category = category
            recipe.image_url = entry.get("image_url")
            recipe.source_url = source_url
            for macro in ("kcal_100g", "protein_100g", "fat_100g", "carbs_100g"):
                if entry.get(macro) is not None:
                    setattr(recipe, macro, float(entry[macro]))
            session.query(RecipeIngredient).filter_by(recipe_id=recipe.id).delete()
            report.recipes_updated += 1
        else:
            recipe = Recipe(
                user_id=None,
                source="system",
                catalog_key=catalog_key,
                category=category,
                image_url=entry.get("image_url"),
                source_url=source_url,
                kcal_100g=float(entry.get("kcal_100g") or 0),
                protein_100g=float(entry.get("protein_100g") or 0),
                fat_100g=float(entry.get("fat_100g") or 0),
                carbs_100g=float(entry.get("carbs_100g") or 0),
            )
            session.add(recipe)
            session.flush()
            system_by_key[catalog_key] = recipe
            report.recipes_created += 1

        notes = entry.get("notes")
        for locale in SUPPORTED_LOCALES:
            name = (names.get(locale) or "").strip()
            if not name:
                continue
            _upsert_translation(
                recipe.translations,
                locale=locale,
                name=name[:255],
                notes=str(notes) if notes is not None else None,
                model_cls=RecipeTranslation,
                parent_kw="recipe_id",
                parent_id=recipe.id,
            )

        for ing in entry.get("ingredients") or []:
            product_key = (ing.get("key") or "").strip()
            weight = float(ing.get("weight") or 0)
            product_id = product_id_by_key.get(product_key)
            if not product_id or weight <= 0:
                report.recipe_ingredients_skipped += 1
                continue
            session.add(
                RecipeIngredient(recipe_id=recipe.id, product_id=product_id, weight=weight)
            )
            report.recipe_ingredients_linked += 1

    active_keys = set(system_by_key.keys())
    for recipe in (
        session.query(Recipe)
        .filter(Recipe.user_id.is_(None), Recipe.source == "system")
        .all()
    ):
        if recipe.catalog_key not in active_keys:
            session.query(RecipeIngredient).filter_by(recipe_id=recipe.id).delete()
            session.delete(recipe)
            report.rejected.append(f"purged orphan recipe {recipe.catalog_key!r}")


def import_catalog(session: Session) -> CatalogImportReport:
    report = CatalogImportReport()
    try:
        product_id_by_key = import_products_from_canonical(session, report)
        import_recipes_from_canonical(session, product_id_by_key, report)
        session.commit()
    except Exception:
        session.rollback()
        raise
    return report


def sync_global_catalog(session: Session) -> CatalogImportReport:
    return import_catalog(session)


def ensure_global_catalog_loaded(session: Session) -> CatalogImportReport | None:
    return sync_global_catalog(session)


def main() -> None:
    from app.db.session import get_session_factory

    session = get_session_factory()()
    try:
        report = import_catalog(session)
        print(json.dumps(report.as_dict(), indent=2))
    finally:
        session.close()


if __name__ == "__main__":
    main()
