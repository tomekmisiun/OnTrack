"""Tests for central runtime data path resolution (Task 1)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from app.core.config import get_settings
from app.core.runtime_data import (
    RuntimeDataError,
    dish_compare_data_dir,
    macro_ai_cache_path,
    recipes_pl_paths,
    runtime_data_root,
    seeds_dir,
    validate_required_runtime_data,
)

CONSUMER_SERVICE_FILES = (
    Path(__file__).resolve().parents[1] / "app" / "services" / "dish_compare_loader.py",
    Path(__file__).resolve().parents[1] / "app" / "services" / "import_names.py",
    Path(__file__).resolve().parents[1] / "app" / "services" / "macro_lookup.py",
    Path(__file__).resolve().parents[1] / "app" / "services" / "recipe_image_service.py",
)

FORBIDDEN_CONSUMER_PATTERNS = (
    "parents[3]",
    "parents[2]",
    "_repo_root",
    "scraper/data",
    "scraper/",
)


@pytest.fixture
def clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _write_minimal_runtime_tree(root: Path) -> None:
    (root / "generated").mkdir(parents=True)
    (root / "dish_compare" / "defaults").mkdir(parents=True)
    (root / "dish_compare" / "built").mkdir(parents=True)
    (root / "recipes").mkdir(parents=True)
    (root / "cache").mkdir(parents=True)

    envelope = {"meta": {"generated": True, "do_not_edit": True, "canonical_version": "test"}, "items": [{"name": "x", "price": 1, "package_weight": 100}]}
    recipe_envelope = {"meta": {"generated": True, "do_not_edit": True, "canonical_version": "test"}, "items": [{"name": "r", "ingredients": [{"product_name": "x", "weight": 10}]}]}
    for fname in ("products_PL.json", "recipes_PL.json"):
        (root / "generated" / fname).write_text(json.dumps(envelope if "products" in fname else recipe_envelope), encoding="utf-8")

    for lang in ("pl", "en"):
        (root / "dish_compare" / "defaults" / f"{lang}.json").write_text(
            json.dumps({"currency": "PLN", "dishes": {}}),
            encoding="utf-8",
        )
        (root / "dish_compare" / "built" / f"{lang}.json").write_text(
            json.dumps({"currency": "PLN", "dishes": []}),
            encoding="utf-8",
        )

    (root / "recipes" / "recipes_pl.json").write_text("[]", encoding="utf-8")


def test_runtime_data_dir_override_paths(tmp_path, monkeypatch, clear_settings_cache):
    data_root = tmp_path / "runtime"
    _write_minimal_runtime_tree(data_root)
    monkeypatch.setenv("RUNTIME_DATA_DIR", str(data_root))

    assert runtime_data_root() == data_root
    assert seeds_dir() == data_root / "seeds"
    assert dish_compare_data_dir() == data_root / "dish_compare"
    assert recipes_pl_paths() == (data_root / "recipes" / "recipes_pl.json",)
    assert macro_ai_cache_path() == data_root / "cache" / "macro_ai_cache.json"


def test_default_runtime_root_is_backend_data(monkeypatch, clear_settings_cache):
    monkeypatch.delenv("RUNTIME_DATA_DIR", raising=False)
    backend_root = Path(__file__).resolve().parents[1]

    assert runtime_data_root() == backend_root / "data"
    assert seeds_dir() == backend_root / "data" / "seeds"
    assert dish_compare_data_dir() == backend_root / "data" / "dish_compare"
    assert recipes_pl_paths()[0] == backend_root / "data" / "recipes" / "recipes_pl.json"
    assert macro_ai_cache_path() == backend_root / "data" / "cache" / "macro_ai_cache.json"


def test_user_seeds_dir_overrides_seeds_path(tmp_path, monkeypatch, clear_settings_cache):
    custom = tmp_path / "custom-seeds"
    custom.mkdir()
    monkeypatch.setenv("RUNTIME_DATA_DIR", str(tmp_path / "runtime"))
    get_settings.cache_clear()
    monkeypatch.setenv("USER_SEEDS_DIR", str(custom))
    get_settings.cache_clear()

    assert seeds_dir() == custom


def test_validate_required_runtime_data_passes_with_complete_tree(
    tmp_path, monkeypatch, clear_settings_cache
):
    data_root = tmp_path / "runtime"
    _write_minimal_runtime_tree(data_root)
    monkeypatch.setenv("RUNTIME_DATA_DIR", str(data_root))

    validate_required_runtime_data()


def test_validate_required_runtime_data_clear_error(tmp_path, monkeypatch, clear_settings_cache):
    data_root = tmp_path / "runtime"
    _write_minimal_runtime_tree(data_root)
    missing = data_root / "dish_compare" / "built" / "pl.json"
    missing.unlink()
    monkeypatch.setenv("RUNTIME_DATA_DIR", str(data_root))

    with pytest.raises(RuntimeDataError) as exc_info:
        validate_required_runtime_data()

    message = str(exc_info.value)
    assert "dish_compare built (pl)" in message
    assert str(missing) in message


def test_consumers_do_not_resolve_paths_manually():
    for path in CONSUMER_SERVICE_FILES:
        source = path.read_text(encoding="utf-8")
        for pattern in FORBIDDEN_CONSUMER_PATTERNS:
            assert pattern not in source, f"{path.name} must not contain {pattern!r}"


def test_consumers_import_runtime_data_module():
    for path in CONSUMER_SERVICE_FILES:
        source = path.read_text(encoding="utf-8")
        if path.name == "import_names.py":
            assert "catalog_data" in source, f"{path.name} should use app.core.catalog_data"
        else:
            assert "runtime_data" in source, f"{path.name} should use app.core.runtime_data"
