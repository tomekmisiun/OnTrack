"""Load and build dish-compare data from app/dish_compare/data/."""

from __future__ import annotations

import json
from pathlib import Path

from app.paths import DISH_COMPARE_DIR

SUPPORTED_LANGS = ("pl", "en")


def dish_compare_root() -> Path:
    return DISH_COMPARE_DIR


def _read_json(path: Path) -> dict | list:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_manifest(lang: str | None = None) -> list[str]:
    data = _read_json(DISH_COMPARE_DIR / "manifest.json")
    if lang:
        lang = lang if lang in SUPPORTED_LANGS else "pl"
        if isinstance(data.get(lang), list):
            return list(data[lang])
    if isinstance(data.get("dishes"), list):
        return list(data["dishes"])
    return list(data["pl"])


def load_dish_template(dish_id: str) -> dict:
    return _read_json(DISH_COMPARE_DIR / "dishes" / f"{dish_id}.json")


def load_defaults(lang: str) -> dict:
    lang = lang if lang in SUPPORTED_LANGS else "pl"
    return _read_json(DISH_COMPARE_DIR / "defaults" / f"{lang}.json")


def load_catalog(lang: str) -> dict[str, dict]:
    """Manual price catalog for dish-compare. Keys are catalog_id."""
    lang = lang if lang in SUPPORTED_LANGS else "pl"
    path = DISH_COMPARE_DIR / "catalog" / f"{lang}.json"
    if not path.exists():
        raise FileNotFoundError(f"catalog missing: {path}")
    raw = _read_json(path)
    return {
        key: value
        for key, value in raw.items()
        if not key.startswith("_") and isinstance(value, dict)
    }


def catalog_ingredient_cost(entry: dict, weight: float) -> float:
    price = float(entry.get("price") or 0)
    basis = entry.get("price_basis") or "per_100g"

    if basis == "per_piece":
        return round(weight * price, 2)
    if basis == "per_package":
        package_weight = float(entry.get("package_weight") or 1)
        if package_weight <= 0:
            return 0.0
        return round((weight / package_weight) * price, 2)
    return round((weight / 100) * price, 2)


def validate_manifest_consistency() -> None:
    defaults_pl = load_defaults("pl")["dishes"]
    defaults_en = load_defaults("en")["dishes"]
    catalog_en = load_catalog("en")
    catalog_pl = load_catalog("pl")
    errors: list[str] = []

    dish_ids_pl = set(load_manifest("pl"))
    dish_ids_en = set(load_manifest("en"))
    all_dish_ids = dish_ids_pl | dish_ids_en

    for dish_id in sorted(all_dish_ids):
        path = DISH_COMPARE_DIR / "dishes" / f"{dish_id}.json"
        if not path.exists():
            errors.append(f"missing dish file: dishes/{dish_id}.json")
            continue
        if dish_id in dish_ids_pl and dish_id not in defaults_pl:
            errors.append(f"missing defaults/pl.json entry for dish '{dish_id}'")
        if dish_id in dish_ids_en and dish_id not in defaults_en:
            errors.append(f"missing defaults/en.json entry for dish '{dish_id}'")

        dish = load_dish_template(dish_id)
        for lang, catalog in (("en", catalog_en), ("pl", catalog_pl)):
            key = f"ingredients_{lang}"
            manifest_ids = dish_ids_en if lang == "en" else dish_ids_pl
            if dish_id not in manifest_ids:
                continue
            for item in dish.get(key) or []:
                catalog_id = item.get("catalog_id")
                if not catalog_id:
                    errors.append(f"dish '{dish_id}': {key} entry missing catalog_id")
                elif catalog_id not in catalog:
                    errors.append(
                        f"dish '{dish_id}': catalog_id '{catalog_id}' not in catalog/{lang}.json"
                    )

    if errors:
        raise ValueError("dish_compare manifest validation failed:\n  " + "\n  ".join(errors))


def build_diy_for_dish(dish: dict, catalog: dict[str, dict], lang: str) -> dict:
    ingredients_key = "ingredients_pl" if lang == "pl" else "ingredients_en"
    ingredients_raw = dish[ingredients_key]
    ingredients = []
    total = 0.0

    for item in ingredients_raw:
        catalog_id = item["catalog_id"]
        entry = catalog.get(catalog_id)
        if not entry:
            raise ValueError(
                f"dish '{dish['id']}' ({lang}): catalog_id '{catalog_id}' not in catalog/{lang}.json"
            )
        weight = float(item["weight"])
        cost = catalog_ingredient_cost(entry, weight)
        total += cost
        ingredients.append({
            "product_name": entry.get("label") or catalog_id,
            "weight": weight,
            "unit": entry.get("unit") or "g",
            "cost": cost,
        })

    return {
        "id": dish["id"],
        "name": dish["name_pl"] if lang == "pl" else dish["name_en"],
        "portion_note": dish["portion_note_pl"] if lang == "pl" else dish["portion_note_en"],
        "diy_cost": round(total, 2),
        "ingredients": ingredients,
    }


def build_built_payload(lang: str) -> dict:
    validate_manifest_consistency()
    lang = lang if lang in SUPPORTED_LANGS else "pl"
    defaults = load_defaults(lang)
    catalog = load_catalog(lang)
    dishes = []

    for dish_id in load_manifest(lang):
        template = load_dish_template(dish_id)
        dishes.append(build_diy_for_dish(template, catalog, lang))

    return {
        "lang": lang,
        "currency": defaults["currency"],
        "dishes": dishes,
    }


def load_built(lang: str) -> dict:
    lang = lang if lang in SUPPORTED_LANGS else "pl"
    path = DISH_COMPARE_DIR / "built" / f"{lang}.json"
    if not path.exists():
        raise FileNotFoundError(f"built file missing: {path} — run app/dish_compare/build.py")
    return _read_json(path)


def load_dish_compare(lang: str) -> dict:
    """Merge pre-built DIY costs with editable defaults for API response."""
    lang = lang if lang in SUPPORTED_LANGS else "pl"
    built = load_built(lang)
    defaults = load_defaults(lang)
    dish_defaults = defaults.get("dishes") or {}

    merged_dishes = []
    for dish in built["dishes"]:
        ddef = dish_defaults.get(dish["id"], {})
        merged_dishes.append({
            **dish,
            "defaults": {
                "avg_restaurant_price": ddef.get("avg_restaurant_price", 0),
                "price_note": ddef.get("price_note", ""),
            },
        })

    return {
        "lang": lang,
        "currency": defaults.get("currency") or built.get("currency"),
        "dishes": merged_dishes,
        "default_delivery_price": defaults.get("default_delivery_price", 0),
        "meal_prep": defaults.get("meal_prep") or {
            "hours_per_week": 2.5,
            "avg_hourly_wage": 33.7 if lang == "pl" else 13.5,
        },
    }
