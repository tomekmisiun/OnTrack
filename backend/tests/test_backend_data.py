"""Tests for backend/data demo dataset and validate_runtime_data.py."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from app.core.catalog_data import generated_products_path, read_generated_items
from app.core.config import get_settings
from app.core.runtime_data import (
    dish_compare_data_dir,
    ingredients_macros_paths,
    recipes_pl_paths,
    runtime_data_root,
)
from app.services.dish_compare_loader import load_dish_compare
from app.services.import_names import translate_product_name
from app.services.macro_lookup import lookup_macros
from scripts.validate_runtime_data import ValidationError, validate_runtime_data

BACKEND_DATA = Path(__file__).resolve().parents[1] / "data"


@pytest.fixture
def use_backend_data(monkeypatch):
    monkeypatch.setenv("RUNTIME_DATA_DIR", str(BACKEND_DATA))
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_validate_runtime_data_passes_on_backend_data():
    validate_runtime_data(BACKEND_DATA)


def test_validate_runtime_data_fails_on_missing_manifest(tmp_path):
    with pytest.raises(ValidationError, match="missing manifest"):
        validate_runtime_data(tmp_path)


def test_validate_runtime_data_fails_on_empty_product_name(tmp_path):
    root = tmp_path / "data"
    (root / "generated").mkdir(parents=True)
    manifest = json.loads((BACKEND_DATA / "manifest.json").read_text())
    (root / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    for rel in [e["path"] for e in manifest["files"]]:
        src = BACKEND_DATA / rel
        dest = root / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(src.read_text(encoding="utf-8"), encoding="utf-8")
    bad = json.loads((root / "generated/products_PL.json").read_text())
    bad["items"][0]["name"] = ""
    (root / "generated/products_PL.json").write_text(json.dumps(bad), encoding="utf-8")
    with pytest.raises(ValidationError, match="empty name"):
        validate_runtime_data(root)


def test_runtime_data_dir_points_at_backend_data(use_backend_data):
    assert runtime_data_root() == BACKEND_DATA
    assert dish_compare_data_dir() == BACKEND_DATA / "dish_compare"
    assert ingredients_macros_paths()[0] == BACKEND_DATA / "macros" / "ingredients_macros.json"
    assert recipes_pl_paths()[0] == BACKEND_DATA / "recipes" / "recipes_pl.json"


def test_dish_compare_loads_from_backend_data(use_backend_data):
    data = load_dish_compare("pl")
    assert data["currency"] == "PLN"
    assert len(data["dishes"]) == 5
    assert next(d for d in data["dishes"] if d["id"] == "spaghetti_bolognese")["name"]


def test_macro_lookup_uses_backend_data(use_backend_data):
    import app.services.macro_lookup as macro_mod

    macro_mod._macro_map_pl = None
    macro_mod._macro_map_en = None
    result = lookup_macros("jogurt naturalny", lang="pl")
    assert result["found"] is True
    assert result["kcal"] == 60.0


def test_import_names_uses_backend_data_macros(use_backend_data):
    assert translate_product_name("jogurt naturalny", "en") in (
        "natural yogurt",
        "jogurt naturalny",
    )


def test_generated_catalog_loads_pl_products(use_backend_data):
    _, products = read_generated_items(generated_products_path("PL"))
    assert len(products) >= 1
    assert products[0]["name"]
