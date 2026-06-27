"""UI locale vs product market — independent concerns."""

from __future__ import annotations

UI_LOCALES = frozenset({"pl", "en"})
MARKET_CODES = frozenset({"PL", "GB"})

MARKET_BY_UI_LOCALE_DEFAULT: dict[str, str] = {
    "pl": "PL",
    "en": "GB",
}

CURRENCY_BY_MARKET: dict[str, str] = {
    "PL": "PLN",
    "GB": "GBP",
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


def currency_for_market(market_code: str) -> str:
    return CURRENCY_BY_MARKET.get(market_code, "PLN")
