"""Load dish-compare data from the configured runtime data directory."""

from __future__ import annotations

import json
from pathlib import Path

from app.core.runtime_data import dish_compare_data_dir

SUPPORTED_LANGS = ("pl", "en")


def _read_json(path: Path) -> dict | list:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_defaults(lang: str) -> dict:
    lang = lang if lang in SUPPORTED_LANGS else "pl"
    return _read_json(dish_compare_data_dir() / "defaults" / f"{lang}.json")


def load_built(lang: str) -> dict:
    lang = lang if lang in SUPPORTED_LANGS else "pl"
    path = dish_compare_data_dir() / "built" / f"{lang}.json"
    if not path.exists():
        raise FileNotFoundError(f"built file missing: {path}")
    return _read_json(path)


def load_dish_compare(lang: str) -> dict:
    lang = lang if lang in SUPPORTED_LANGS else "pl"
    built = load_built(lang)
    defaults = load_defaults(lang)
    dish_defaults = defaults.get("dishes") or {}

    merged_dishes = []
    for dish in built["dishes"]:
        ddef = dish_defaults.get(dish["id"], {})
        merged_dishes.append(
            {
                **dish,
                "defaults": {
                    "avg_restaurant_price": ddef.get("avg_restaurant_price", 0),
                    "price_note": ddef.get("price_note", ""),
                },
            }
        )

    return {
        "lang": lang,
        "currency": defaults.get("currency") or built.get("currency"),
        "dishes": merged_dishes,
        "default_delivery_price": defaults.get("default_delivery_price", 0),
        "meal_prep": defaults.get("meal_prep")
        or {
            "hours_per_week": 2.5,
            "avg_hourly_wage": 33.7 if lang == "pl" else 13.5,
        },
    }
