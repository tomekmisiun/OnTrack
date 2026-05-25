"""Tests for public dish-compare data loading."""
import json
from pathlib import Path

import pytest

from app.dish_compare import build_built_payload, load_dish_compare, load_manifest, validate_manifest_consistency

ROOT = Path(__file__).resolve().parents[1]
BUILT_PL = ROOT / "app" / "dish_compare" / "data" / "built" / "pl.json"
BUILT_EN = ROOT / "app" / "dish_compare" / "data" / "built" / "en.json"


def test_manifest_consistency():
    validate_manifest_consistency()


def test_manifest_per_lang():
    assert len(load_manifest("pl")) == 5
    assert len(load_manifest("en")) == 5
    assert "spaghetti_bolognese" in load_manifest("pl")
    assert "chicken_chow_mein" in load_manifest("en")
    assert "kebab" not in load_manifest("pl")


def test_build_built_payload_pl():
    payload = build_built_payload("pl")
    assert payload["lang"] == "pl"
    assert len(payload["dishes"]) == 5
    defaults = json.loads((ROOT / "app/dish_compare/data/defaults/pl.json").read_text())
    delivery = defaults["default_delivery_price"]
    for dish in payload["dishes"]:
        ddef = defaults["dishes"][dish["id"]]
        order_total = ddef["avg_restaurant_price"] + delivery
        assert dish["diy_cost"] < order_total
        ing_total = round(sum(i["cost"] for i in dish["ingredients"]), 2)
        assert dish["diy_cost"] == ing_total


def test_build_built_payload_en_uses_catalog():
    payload = build_built_payload("en")
    assert payload["lang"] == "en"
    assert len(payload["dishes"]) == 5
    defaults = json.loads((ROOT / "app/dish_compare/data/defaults/en.json").read_text())
    delivery = defaults["default_delivery_price"]
    for dish in payload["dishes"]:
        ddef = defaults["dishes"][dish["id"]]
        order_total = ddef["avg_restaurant_price"] + delivery
        assert dish["diy_cost"] < order_total
        ing_total = round(sum(i["cost"] for i in dish["ingredients"]), 2)
        assert dish["diy_cost"] == ing_total


@pytest.mark.skipif(not BUILT_PL.exists(), reason="built/pl.json missing — run app/dish_compare/build.py")
def test_load_dish_compare_merge_pl():
    data = load_dish_compare("pl")
    assert data["currency"] == "PLN"
    assert len(data["dishes"]) == 5
    assert data["default_delivery_price"] == 6.0
    assert next(d for d in data["dishes"] if d["id"] == "spaghetti_bolognese")


@pytest.mark.skipif(not BUILT_EN.exists(), reason="built/en.json missing — run app/dish_compare/build.py")
def test_load_dish_compare_merge_en():
    data = load_dish_compare("en")
    assert data["currency"] == "GBP"
    assert len(data["dishes"]) == 5
    assert next(d for d in data["dishes"] if d["id"] == "chicken_chow_mein")


def test_built_files_committed():
    assert BUILT_PL.exists()
    with open(BUILT_PL, encoding="utf-8") as f:
        data = json.load(f)
    assert len(data["dishes"]) == 5
