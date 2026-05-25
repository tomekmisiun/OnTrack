"""Dish compare widget — login-page DIY vs restaurant cost comparison."""

from app.dish_compare.loader import (
    build_built_payload,
    build_diy_for_dish,
    catalog_ingredient_cost,
    dish_compare_root,
    load_built,
    load_catalog,
    load_defaults,
    load_dish_compare,
    load_dish_template,
    load_manifest,
    validate_manifest_consistency,
)

__all__ = [
    "build_built_payload",
    "build_diy_for_dish",
    "catalog_ingredient_cost",
    "dish_compare_root",
    "load_built",
    "load_catalog",
    "load_defaults",
    "load_dish_compare",
    "load_dish_template",
    "load_manifest",
    "validate_manifest_consistency",
]
