"""Build generated market catalog artifacts from canonical JSON.

Reads ONLY ``backend/data/canonical/`` (never DB, never user_id=1).

Usage:
  uv run python -m app.scripts.build_catalog
  uv run python -m app.scripts.build_catalog --check
"""

from __future__ import annotations

import argparse
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
    wrap_generated,
    write_generated,
)
from app.domain.catalog_seed import (
    expand_products_catalog,
    expand_recipes_catalog,
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


def build(*, check: bool = False) -> int:
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
    args = parser.parse_args()
    raise SystemExit(build(check=args.check))


if __name__ == "__main__":
    main()
