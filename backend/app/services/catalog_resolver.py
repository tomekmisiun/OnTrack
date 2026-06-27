"""Resolve localized catalog fields independently from market pricing."""

from __future__ import annotations

from dataclasses import dataclass

from app.domain.market import currency_for_market
from app.models.product import Product
from app.models.product_market_price import ProductMarketPrice
from app.models.product_translation import ProductTranslation
from app.models.recipe import Recipe

DEFAULT_CATALOG_LOCALE = "pl"
CATALOG_LOCALE_FALLBACK_ORDER = ("pl", "en")


class CatalogResolutionError(Exception):
    """Missing translation for a system catalog row."""


@dataclass(frozen=True)
class ResolvedProduct:
    product: Product
    name: str
    price: float | None
    currency: str | None
    package_weight: float | None
    unit: str | None
    sold_by_weight: bool
    has_price: bool


@dataclass(frozen=True)
class ResolvedRecipe:
    recipe: Recipe
    name: str
    notes: str | None


def _translation_map(product: Product) -> dict[str, str]:
    return {row.locale: row.name for row in product.translations}


def _price_map(product: Product) -> dict[str, ProductMarketPrice]:
    return {row.market_code: row for row in product.market_prices}


def resolve_locale_name(
    translations: dict[str, str],
    *,
    locale: str,
    context: str,
) -> str:
    if locale in translations:
        return translations[locale]
    for fallback in CATALOG_LOCALE_FALLBACK_ORDER:
        if fallback in translations:
            return translations[fallback]
    raise CatalogResolutionError(f"Missing translation for {context} (locale={locale})")


def resolve_product(
    product: Product,
    *,
    locale: str,
    market_code: str,
) -> ResolvedProduct:
    if product.user_name:
        name = product.user_name
    else:
        name = resolve_locale_name(
            _translation_map(product),
            locale=locale,
            context=f"product id={product.id} catalog_key={product.catalog_key!r}",
        )

    market_row = _price_map(product).get(market_code)
    currency = currency_for_market(market_code)
    if market_row is None:
        return ResolvedProduct(
            product=product,
            name=name,
            price=None,
            currency=currency,
            package_weight=None,
            unit=None,
            sold_by_weight=False,
            has_price=False,
        )

    return ResolvedProduct(
        product=product,
        name=name,
        price=market_row.amount,
        currency=market_row.currency,
        package_weight=market_row.package_weight,
        unit=market_row.unit,
        sold_by_weight=market_row.sold_by_weight,
        has_price=True,
    )


def resolve_recipe(recipe: Recipe, *, locale: str) -> ResolvedRecipe:
    if recipe.user_name:
        return ResolvedRecipe(recipe=recipe, name=recipe.user_name, notes=recipe.notes)

    translations: dict[str, tuple[str, str | None]] = {
        row.locale: (row.name, row.notes) for row in recipe.translations
    }
    if locale in translations:
        name, notes = translations[locale]
        return ResolvedRecipe(recipe=recipe, name=name, notes=notes)
    for fallback in CATALOG_LOCALE_FALLBACK_ORDER:
        if fallback in translations:
            name, notes = translations[fallback]
            return ResolvedRecipe(recipe=recipe, name=name, notes=notes)
    raise CatalogResolutionError(
        f"Missing translation for recipe id={recipe.id} catalog_key={recipe.catalog_key!r} "
        f"(locale={locale})"
    )


def upsert_product_translation(product: Product, *, locale: str, name: str) -> None:
    for row in product.translations:
        if row.locale == locale:
            row.name = name
            return
    product.translations.append(ProductTranslation(product=product, locale=locale, name=name))
