"""UI locale vs product market — catalog mapping."""

from __future__ import annotations

UI_LOCALES = frozenset({"pl", "en"})
MARKET_CODES = frozenset({"PL", "GB"})

# Catalog rows in `products.lang` still use pl/en; markets use ISO-like codes.
CATALOG_LANG_BY_MARKET: dict[str, str] = {
    "PL": "pl",
    "GB": "en",
}

MARKET_BY_UI_LOCALE_DEFAULT: dict[str, str] = {
    "pl": "PL",
    "en": "GB",
}


def normalize_ui_locale(value: str | None) -> str:
    if value in UI_LOCALES:
        return value
    return "pl"


def default_market_for_ui_locale(ui_locale: str) -> str:
    return MARKET_BY_UI_LOCALE_DEFAULT.get(normalize_ui_locale(ui_locale), "PL")


def normalize_market_code(value: str | None, *, ui_locale: str | None = None) -> str:
    if value in MARKET_CODES:
        return value
    if ui_locale:
        return default_market_for_ui_locale(ui_locale)
    return "PL"


def catalog_lang_for_market(market_code: str) -> str:
    return CATALOG_LANG_BY_MARKET.get(market_code, "pl")
