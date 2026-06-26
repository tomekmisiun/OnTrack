"""Build generated market catalog artifacts from canonical JSON.

Reads ONLY ``backend/data/canonical/`` (never DB, never user_id=1).

Usage:
  uv run python -m app.scripts.build_catalog
  uv run python -m app.scripts.build_catalog --check
  uv run python -m app.scripts.build_catalog --from-snapshot   # migration-only rebuild
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from app.core.catalog_data import (
    MARKETS,
    canonical_products_path,
    canonical_recipes_path,
    canonical_version_hash,
    generated_dir,
    generated_products_path,
    generated_recipes_path,
    load_json_list,
    user_snapshot_dir,
    wrap_generated,
    write_generated,
)
from app.core.runtime_data import runtime_data_root
from app.domain.catalog_seed import (
    expand_products_catalog,
    expand_recipes_catalog,
)
from app.scripts.build_catalog_seeds import (
    _load_en_ingredient_db,
    _load_macros,
    _load_scraper_recipes,
    _product_key_by_pl_name,
    build_products_catalog,
    build_recipes_catalog,
)


def _write_all_generated(products_catalog: list[dict], recipes_catalog: list[dict]) -> dict[str, dict[str, int]]:
    version = canonical_version_hash(products_catalog, recipes_catalog)
    stats: dict[str, dict[str, int]] = {}
    locale_map = {"PL": "pl", "GB": "en"}
    for market in MARKETS:
        lang = locale_map[market]
        products = expand_products_catalog(products_catalog, lang)
        recipes = expand_recipes_catalog(recipes_catalog, lang)
        write_generated(
            generated_products_path(market),
            wrap_generated(products, market_code=market, canonical_version=version),
        )
        write_generated(
            generated_recipes_path(market),
            wrap_generated(recipes, market_code=market, canonical_version=version),
        )
        stats[market] = {"products": len(products), "recipes": len(recipes)}
    return stats


def _rebuild_canonical_from_snapshot() -> tuple[list[dict], list[dict]]:
    """Migration-only: raw/user_1 snapshot + scraper refs → canonical."""
    repo_root = runtime_data_root().parent.parent
    snap = user_snapshot_dir()
    pl_products = load_json_list(snap / "products_pl.json")
    pl_recipes = load_json_list(snap / "recipes_pl.json")
    macros_by_pl, _ = _load_macros(repo_root)
    en_db = _load_en_ingredient_db(repo_root)
    scraper_by_url = _load_scraper_recipes(repo_root)
    products_catalog = build_products_catalog(pl_products, macros_by_pl, en_db)
    product_keys = _product_key_by_pl_name(products_catalog)
    recipes_catalog = build_recipes_catalog(pl_recipes, scraper_by_url, product_keys, products_catalog)
    canonical_dir = canonical_products_path().parent
    canonical_dir.mkdir(parents=True, exist_ok=True)
    canonical_products_path().write_text(
        json.dumps(products_catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    canonical_recipes_path().write_text(
        json.dumps(recipes_catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return products_catalog, recipes_catalog


def build(*, check: bool = False, from_snapshot: bool = False) -> int:
    if from_snapshot:
        products_catalog, recipes_catalog = _rebuild_canonical_from_snapshot()
        print(f"Rebuilt canonical from snapshot: {len(products_catalog)} products, {len(recipes_catalog)} recipes")
    else:
        if not canonical_products_path().is_file() or not canonical_recipes_path().is_file():
            print("ERROR: canonical/products.json or canonical/recipes.json missing", file=sys.stderr)
            return 1
        products_catalog = load_json_list(canonical_products_path())
        recipes_catalog = load_json_list(canonical_recipes_path())

    expected_stats = _write_all_generated(products_catalog, recipes_catalog)

    if check:
        for market, counts in expected_stats.items():
            _, live_products = _read_generated_items_safe(generated_products_path(market))
            _, live_recipes = _read_generated_items_safe(generated_recipes_path(market))
            if len(live_products) != counts["products"] or len(live_recipes) != counts["recipes"]:
                print(f"DRIFT: generated/{market} out of sync with canonical", file=sys.stderr)
                return 1
        print("OK: generated catalog matches canonical")
        return 0

    for market, counts in expected_stats.items():
        print(f"  {market}: {counts['products']} products, {counts['recipes']} recipes")
    print(f"Written to {generated_dir()}")
    return 0


def _read_generated_items_safe(path: Path) -> tuple[dict, list[dict]]:
    from app.core.catalog_data import read_generated_items

    return read_generated_items(path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build generated catalog from canonical JSON")
    parser.add_argument("--check", action="store_true", help="Fail if generated files drift from canonical")
    parser.add_argument(
        "--from-snapshot",
        action="store_true",
        help="Migration-only: rebuild canonical from raw/user_1_catalog_snapshot/",
    )
    args = parser.parse_args()
    raise SystemExit(build(check=args.check, from_snapshot=args.from_snapshot))


if __name__ == "__main__":
    main()
