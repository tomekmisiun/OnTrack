"""Canonical bilingual catalog → per-lang generated JSON.

Architecture (see backend/data/README.md):
- ``ui_locale`` (pl/en) = UI language only
- ``market_code`` (PL/GB) = product/recipe catalog (pl/en rows in DB)
- Source of truth: ``backend/data/canonical/*.json``
"""

from __future__ import annotations

import re
from typing import Any

from app.domain.product_normalize import normalize_product_name

_CATALOG_KEY_SAFE = re.compile(r"[^a-z0-9._-]+")
MARKET_BY_LANG = {"pl": "PL", "en": "GB"}
LANG_BY_MARKET = {"PL": "pl", "GB": "en"}


def slug_catalog_key(raw: str) -> str:
    slug = _CATALOG_KEY_SAFE.sub("-", normalize_product_name(raw).replace(" ", "-")).strip("-")
    return slug[:80] or "item"


def market_row_to_product(
    name: str, market: dict[str, Any], macros: dict[str, Any]
) -> dict[str, Any]:
    row: dict[str, Any] = {
        "name": name,
        "price": float(market.get("price") or 0),
        "package_weight": float(market.get("package_weight") or 100),
        "unit": market.get("unit") or "g",
        "sold_by_weight": bool(market.get("sold_by_weight", False)),
    }
    for field in ("kcal", "protein", "fat", "carbs"):
        if macros.get(field) is not None:
            row[field] = macros[field]
    return row


def expand_products_catalog(catalog: list[dict[str, Any]], lang: str) -> list[dict[str, Any]]:
    market = MARKET_BY_LANG.get(lang)
    if not market:
        return []
    out: list[dict[str, Any]] = []
    seen_names: set[str] = set()
    for sort_index, entry in enumerate(catalog):
        names = entry.get("names") or {}
        name = (names.get(lang) or "").strip()
        markets = entry.get("markets") or {}
        if not name or market not in markets:
            continue
        name_key = name.lower()
        if name_key in seen_names:
            continue
        seen_names.add(name_key)
        stable_key = (entry.get("key") or slug_catalog_key(name)).strip()
        out.append(
            {
                **market_row_to_product(name, markets[market], entry.get("macros") or {}),
                "stable_key": stable_key,
                "sort_index": sort_index,
            }
        )
    return out


def expand_recipes_catalog(catalog: list[dict[str, Any]], lang: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for sort_index, entry in enumerate(catalog):
        names = entry.get("names") or {}
        name = (names.get(lang) or "").strip()
        if not name:
            continue
        ingredients_out: list[dict[str, Any]] = []
        for ing in entry.get("ingredients") or []:
            ing_names = ing.get("names") or {}
            pname = (ing_names.get(lang) or "").strip()
            if not pname:
                continue
            ingredients_out.append(
                {"product_name": pname, "weight": float(ing.get("weight") or 0)}
            )
        if not ingredients_out:
            continue
        source_url = (entry.get("source_url") or "").strip() or None
        stable_key = (entry.get("key") or slug_catalog_key(source_url or name)).strip()
        row: dict[str, Any] = {
            "name": name,
            "category": entry.get("category"),
            "notes": entry.get("notes"),
            "image_url": entry.get("image_url"),
            "source_url": source_url,
            "ingredients": ingredients_out,
            "stable_key": stable_key,
            "sort_index": sort_index,
        }
        for macro in ("kcal_100g", "protein_100g", "fat_100g", "carbs_100g"):
            if entry.get(macro) is not None:
                row[macro] = entry[macro]
        out.append(row)
    return out
