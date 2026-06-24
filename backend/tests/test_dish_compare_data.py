"""Tests for dish-compare runtime data in backend/data."""

from __future__ import annotations

import json
from pathlib import Path

from app.services.dish_compare_loader import load_dish_compare, load_defaults

DATA_ROOT = Path(__file__).resolve().parents[1] / "data"


def test_dish_compare_defaults_pl():
    defaults = load_defaults("pl")
    assert defaults["currency"] == "PLN"
    assert "spaghetti_bolognese" in defaults["dishes"]


def test_dish_compare_defaults_en():
    defaults = load_defaults("en")
    assert defaults["currency"] == "GBP"
    assert "chicken_chow_mein" in defaults["dishes"]


def test_load_dish_compare_merge_pl():
    data = load_dish_compare("pl")
    assert data["currency"] == "PLN"
    assert len(data["dishes"]) == 5
    assert data["default_delivery_price"] == 6.0
    spaghetti = next(d for d in data["dishes"] if d["id"] == "spaghetti_bolognese")
    assert spaghetti["name"]
    assert "defaults" in spaghetti


def test_load_dish_compare_merge_en():
    data = load_dish_compare("en")
    assert data["currency"] == "GBP"
    assert len(data["dishes"]) == 5
    assert next(d for d in data["dishes"] if d["id"] == "chicken_chow_mein")


def test_built_files_present_in_backend_data():
    for lang in ("pl", "en"):
        path = DATA_ROOT / "dish_compare" / "built" / f"{lang}.json"
        assert path.is_file()
        payload = json.loads(path.read_text(encoding="utf-8"))
        assert len(payload["dishes"]) == 5
