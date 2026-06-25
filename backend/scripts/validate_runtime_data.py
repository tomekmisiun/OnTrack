#!/usr/bin/env python3
"""Validate backend/data runtime dataset against manifest and schema rules."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

EXPECTED_SCHEMA_VERSION = "1"
MANIFEST_REQUIRED_KEYS = frozenset({
    "dataset_version",
    "schema_version",
    "status",
    "dataset_type",
    "provenance",
    "files",
    "limitations",
})
ALLOWED_DATASET_TYPES = frozenset({"curated", "demo", "synthetic"})


class ValidationError(Exception):
    pass


def _backend_data_root() -> Path:
    return Path(__file__).resolve().parents[1] / "data"


def _load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValidationError(f"Invalid JSON: {path}: {exc}") from exc


def _require_number(value: Any, label: str, *, min_value: float | None = None) -> float:
    if not isinstance(value, (int, float)):
        raise ValidationError(f"{label}: expected number, got {type(value).__name__}")
    if min_value is not None and value < min_value:
        raise ValidationError(f"{label}: value {value} < {min_value}")
    return float(value)


def _validate_manifest(manifest: dict, root: Path) -> None:
    missing = MANIFEST_REQUIRED_KEYS - manifest.keys()
    if missing:
        raise ValidationError(f"manifest.json missing keys: {sorted(missing)}")
    if manifest["schema_version"] != EXPECTED_SCHEMA_VERSION:
        raise ValidationError(
            f"manifest schema_version {manifest['schema_version']!r} != {EXPECTED_SCHEMA_VERSION!r}"
        )
    if manifest["dataset_type"] not in ALLOWED_DATASET_TYPES:
        raise ValidationError(f"invalid dataset_type: {manifest['dataset_type']!r}")
    if manifest["dataset_type"] == "curated" and "verified" not in manifest.get("provenance", "").lower():
        raise ValidationError("curated datasets must document verification in provenance")

    files = manifest.get("files")
    if not isinstance(files, list) or not files:
        raise ValidationError("manifest files must be a non-empty list")

    listed_paths: set[str] = set()
    for entry in files:
        if not isinstance(entry, dict) or "path" not in entry:
            raise ValidationError("each manifest.files entry needs a path")
        rel = entry["path"]
        listed_paths.add(rel)
        full = root / rel
        if not full.is_file():
            raise ValidationError(f"manifest lists missing file: {rel}")

    for path in listed_paths:
        if path not in {e["path"] for e in files}:
            raise ValidationError(f"duplicate manifest path: {path}")


def _validate_product_seeds(data: list, label: str) -> None:
    if not isinstance(data, list) or not data:
        raise ValidationError(f"{label}: expected non-empty list")
    names: set[str] = set()
    for idx, row in enumerate(data):
        if not isinstance(row, dict):
            raise ValidationError(f"{label}[{idx}]: expected object")
        name = (row.get("name") or "").strip()
        if not name:
            raise ValidationError(f"{label}[{idx}]: empty name")
        key = name.lower()
        if key in names:
            raise ValidationError(f"{label}: duplicate product name {name!r}")
        names.add(key)
        _require_number(row.get("price"), f"{label}[{idx}].price", min_value=0)
        _require_number(row.get("package_weight"), f"{label}[{idx}].package_weight", min_value=0)


def _validate_recipe_seeds(data: list, label: str) -> None:
    if not isinstance(data, list) or not data:
        raise ValidationError(f"{label}: expected non-empty list")
    for idx, row in enumerate(data):
        if not isinstance(row, dict):
            raise ValidationError(f"{label}[{idx}]: expected object")
        if not (row.get("name") or "").strip():
            raise ValidationError(f"{label}[{idx}]: empty name")
        ingredients = row.get("ingredients")
        if not isinstance(ingredients, list) or not ingredients:
            raise ValidationError(f"{label}[{idx}]: ingredients required")
        for ing_idx, ing in enumerate(ingredients):
            if not (ing.get("product_name") or "").strip():
                raise ValidationError(f"{label}[{idx}].ingredients[{ing_idx}]: empty product_name")
            _require_number(ing.get("weight"), f"{label}[{idx}].ingredients[{ing_idx}].weight", min_value=0)


def _validate_macros(data: list) -> None:
    if not isinstance(data, list) or not data:
        raise ValidationError("macros: expected non-empty list")
    keys_seen: set[str] = set()
    for idx, row in enumerate(data):
        if not isinstance(row, dict):
            raise ValidationError(f"macros[{idx}]: expected object")
        for field in ("name_en", "name_pl"):
            if not (row.get(field) or "").strip():
                raise ValidationError(f"macros[{idx}]: missing {field}")
        dedup = (row["name_pl"] or "").strip().lower()
        if dedup in keys_seen:
            raise ValidationError(f"macros: duplicate name_pl {row['name_pl']!r}")
        keys_seen.add(dedup)
        for macro in ("kcal", "protein_g", "fat_g", "carbs_g"):
            _require_number(row.get(macro), f"macros[{idx}].{macro}", min_value=0)


def _validate_recipes_pl(data: list) -> None:
    if not isinstance(data, list) or not data:
        raise ValidationError("recipes_pl: expected non-empty list")
    for idx, row in enumerate(data):
        if not isinstance(row, dict):
            raise ValidationError(f"recipes_pl[{idx}]: expected object")
        if not ((row.get("name_pl") or row.get("name") or "").strip()):
            raise ValidationError(f"recipes_pl[{idx}]: missing name_pl/name")


def _validate_dish_defaults(data: dict, label: str) -> None:
    if not isinstance(data, dict):
        raise ValidationError(f"{label}: expected object")
    dishes = data.get("dishes")
    if not isinstance(dishes, dict) or not dishes:
        raise ValidationError(f"{label}: dishes object required")
    for dish_id, meta in dishes.items():
        if not dish_id:
            raise ValidationError(f"{label}: empty dish id")
        if not isinstance(meta, dict):
            raise ValidationError(f"{label}.dishes[{dish_id}]: expected object")


def _validate_dish_built(data: dict, label: str) -> None:
    if not isinstance(data, dict):
        raise ValidationError(f"{label}: expected object")
    dishes = data.get("dishes")
    if not isinstance(dishes, list) or not dishes:
        raise ValidationError(f"{label}: dishes array required")
    ids: set[str] = set()
    for idx, dish in enumerate(dishes):
        if not isinstance(dish, dict):
            raise ValidationError(f"{label}.dishes[{idx}]: expected object")
        dish_id = dish.get("id")
        if not dish_id:
            raise ValidationError(f"{label}.dishes[{idx}]: missing id")
        if dish_id in ids:
            raise ValidationError(f"{label}: duplicate dish id {dish_id!r}")
        ids.add(dish_id)
        if not (dish.get("name") or "").strip():
            raise ValidationError(f"{label}.dishes[{idx}]: empty name")
        diy = dish.get("diy_cost")
        if diy is not None:
            _require_number(diy, f"{label}.dishes[{idx}].diy_cost", min_value=0)


def _validate_generated_catalog(data: dict, label: str) -> None:
    if not isinstance(data, dict):
        raise ValidationError(f"{label}: expected object envelope")
    meta = data.get("meta")
    if not isinstance(meta, dict):
        raise ValidationError(f"{label}: missing meta object")
    if not meta.get("generated"):
        raise ValidationError(f"{label}: meta.generated must be true")
    if not meta.get("do_not_edit"):
        raise ValidationError(f"{label}: meta.do_not_edit must be true")
    if not meta.get("canonical_version"):
        raise ValidationError(f"{label}: meta.canonical_version required")
    items = data.get("items")
    if not isinstance(items, list) or not items:
        raise ValidationError(f"{label}: items must be a non-empty list")


def _validate_canonical_products(data: list, label: str) -> None:
    if not isinstance(data, list) or not data:
        raise ValidationError(f"{label}: expected non-empty list")
    keys: set[str] = set()
    for idx, row in enumerate(data):
        if not isinstance(row, dict):
            raise ValidationError(f"{label}[{idx}]: expected object")
        key = (row.get("key") or "").strip()
        if not key:
            raise ValidationError(f"{label}[{idx}]: missing key")
        if key in keys:
            raise ValidationError(f"{label}: duplicate key {key!r}")
        keys.add(key)
        names = row.get("names")
        if not isinstance(names, dict) or not (names.get("pl") or names.get("en")):
            raise ValidationError(f"{label}[{idx}]: names.pl or names.en required")


def _validate_canonical_recipes(data: list, label: str) -> None:
    if not isinstance(data, list) or not data:
        raise ValidationError(f"{label}: expected non-empty list")
    for idx, row in enumerate(data):
        if not isinstance(row, dict):
            raise ValidationError(f"{label}[{idx}]: expected object")
        names = row.get("names")
        if not isinstance(names, dict) or not (names.get("pl") or names.get("en")):
            raise ValidationError(f"{label}[{idx}]: names.pl or names.en required")


def validate_runtime_data(root: Path | None = None) -> None:
    data_root = root or _backend_data_root()
    manifest_path = data_root / "manifest.json"
    if not manifest_path.is_file():
        raise ValidationError(f"missing manifest: {manifest_path}")

    manifest = _load_json(manifest_path)
    if not isinstance(manifest, dict):
        raise ValidationError("manifest.json must be an object")
    _validate_manifest(manifest, data_root)

    def _validate_generated_products(path: Path) -> None:
        data = _load_json(path)
        _validate_generated_catalog(data, path.name)
        _validate_product_seeds(data["items"], path.name)

    def _validate_generated_recipes(path: Path) -> None:
        data = _load_json(path)
        _validate_generated_catalog(data, path.name)
        _validate_recipe_seeds(data["items"], path.name)

    validators: dict[str, Any] = {
        "canonical/products.json": lambda p: _validate_canonical_products(_load_json(p), p.name),
        "canonical/recipes.json": lambda p: _validate_canonical_recipes(_load_json(p), p.name),
        "generated/products_PL.json": _validate_generated_products,
        "generated/products_GB.json": _validate_generated_products,
        "generated/recipes_PL.json": _validate_generated_recipes,
        "generated/recipes_GB.json": _validate_generated_recipes,
        "macros/ingredients_macros.json": lambda p: _validate_macros(_load_json(p)),
        "recipes/recipes_pl.json": lambda p: _validate_recipes_pl(_load_json(p)),
        "dish_compare/defaults/pl.json": lambda p: _validate_dish_defaults(_load_json(p), p.name),
        "dish_compare/defaults/en.json": lambda p: _validate_dish_defaults(_load_json(p), p.name),
        "dish_compare/built/pl.json": lambda p: _validate_dish_built(_load_json(p), p.name),
        "dish_compare/built/en.json": lambda p: _validate_dish_built(_load_json(p), p.name),
    }

    for rel, validator in validators.items():
        validator(data_root / rel)


def main() -> int:
    try:
        validate_runtime_data()
    except ValidationError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    print("OK: backend/data runtime dataset validated")
    return 0


if __name__ == "__main__":
    sys.exit(main())
