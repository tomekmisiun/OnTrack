"""Build canonical bilingual catalog seeds and per-lang runtime JSON.

Source of truth:
  backend/data/seeds/catalog_products.json
  backend/data/seeds/catalog_recipes.json

Generated (do not hand-edit):
  products_seed_{pl,en}.json
  recipes_seed_{pl,en}.json

Usage:
  uv run python -m app.scripts.build_catalog_seeds
  uv run python -m app.scripts.build_catalog_seeds --from-exports \\
      --pl-products backend/data/seeds/products_seed_pl.json \\
      --pl-recipes backend/data/seeds/recipes_seed_pl.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.core.runtime_data import runtime_data_root, seeds_dir
from app.domain.catalog_seed import slug_catalog_key, write_lang_seed_files
from app.domain.product_normalize import normalize_product_name


def _load_json(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return data if isinstance(data, list) else []


def _load_macros(repo_root: Path) -> tuple[dict[str, dict], dict[str, dict]]:
    path = repo_root / "scraper/data/macros/ingredients_macros.json"
    rows = _load_json(path)
    by_pl: dict[str, dict] = {}
    by_en: dict[str, dict] = {}
    for row in rows:
        pl = normalize_product_name(row.get("name_pl") or "")
        en = normalize_product_name(row.get("name_en") or "")
        if pl:
            by_pl[pl] = row
        if en:
            by_en[en] = row
    return by_pl, by_en


def _load_en_ingredient_db(repo_root: Path) -> dict[str, dict]:
    path = repo_root / "scraper/data/built/ingredient_db_en.json"
    by_name: dict[str, dict] = {}
    for row in _load_json(path):
        name = normalize_product_name(row.get("ingredient_name") or "")
        if name and name not in by_name:
            by_name[name] = row
    return by_name


def _load_scraper_recipes(repo_root: Path) -> dict[str, dict]:
    path = repo_root / "scraper/data/built/recipes_pl.json"
    by_url: dict[str, dict] = {}
    for row in _load_json(path):
        url = (row.get("url") or "").strip()
        if url:
            by_url[url] = row
    return by_url


def _match_macro(product_name: str, macros_by_pl: dict[str, dict]) -> dict | None:
    key = normalize_product_name(product_name)
    if key in macros_by_pl:
        return macros_by_pl[key]
    best: dict | None = None
    best_len = 0
    for macro_key, row in macros_by_pl.items():
        if not macro_key:
            continue
        if macro_key in key or key in macro_key:
            if len(macro_key) > best_len:
                best = row
                best_len = len(macro_key)
    return best


def _en_market_from_db(row: dict | None) -> dict | None:
    if not row:
        return None
    unit_raw = row.get("unit") or "g"
    unit = "szt" if unit_raw == "pcs" else (unit_raw or "g")
    pkg = float(row.get("package_size_value") or (1.0 if unit == "szt" else 100.0))
    price_per_100 = row.get("price_per_100")
    price_package = row.get("price_package")
    if price_per_100 is not None:
        price = round(float(price_per_100), 4)
    elif price_package and pkg > 0:
        price = round(float(price_package) / pkg * (1 if unit == "szt" else 100), 4)
    else:
        price = 0.0
    return {
        "price": price,
        "package_weight": round(pkg, 1),
        "unit": unit,
        "sold_by_weight": bool(row.get("sold_by_weight", False)),
    }


def build_products_catalog(
    pl_products: list[dict],
    macros_by_pl: dict[str, dict],
    en_db: dict[str, dict],
) -> list[dict]:
    catalog: list[dict] = []
    seen_keys: set[str] = set()

    for prod in pl_products:
        pl_name = (prod.get("name") or "").strip()
        if not pl_name:
            continue
        macro = _match_macro(pl_name, macros_by_pl)
        en_name = (macro.get("name_en") if macro else pl_name) or pl_name
        key = slug_catalog_key(macro.get("name_en") if macro else pl_name)
        if key in seen_keys:
            key = f"{key}-{slug_catalog_key(pl_name)[:20]}"
        seen_keys.add(key)

        macros = {
            "kcal": prod.get("kcal"),
            "protein": prod.get("protein"),
            "fat": prod.get("fat"),
            "carbs": prod.get("carbs"),
        }
        markets: dict[str, dict] = {
            "PL": {
                "price": prod.get("price"),
                "package_weight": prod.get("package_weight"),
                "unit": prod.get("unit") or "g",
                "sold_by_weight": bool(prod.get("sold_by_weight", False)),
            }
        }
        en_macro_key = normalize_product_name(en_name)
        en_market = _en_market_from_db(en_db.get(en_macro_key))
        if en_market:
            markets["GB"] = en_market

        catalog.append(
            {
                "key": key,
                "names": {"pl": pl_name, "en": en_name},
                "markets": markets,
                "macros": macros,
            }
        )

    catalog.sort(key=lambda e: (e.get("names") or {}).get("pl", "").lower())
    return catalog


def build_recipes_catalog(
    pl_recipes: list[dict],
    scraper_by_url: dict[str, dict],
    product_key_by_pl_name: dict[str, str],
    catalog_products: list[dict],
) -> list[dict]:
    key_to_names: dict[str, dict[str, str]] = {
        e["key"]: e.get("names") or {} for e in catalog_products
    }

    catalog: list[dict] = []
    for recipe in pl_recipes:
        pl_name = (recipe.get("name") or "").strip()
        source_url = (recipe.get("source_url") or "").strip()
        if not pl_name:
            continue
        scraper = scraper_by_url.get(source_url) or {}
        en_name = (scraper.get("name_en") or "").strip() or pl_name

        ingredients_out: list[dict] = []
        for ing in recipe.get("ingredients") or []:
            pl_pname = (ing.get("product_name") or "").strip()
            if not pl_pname:
                continue
            key = product_key_by_pl_name.get(normalize_product_name(pl_pname))
            names = key_to_names.get(key or "", {"pl": pl_pname})
            if not names.get("pl"):
                names = {"pl": pl_pname, **names}
            ingredients_out.append(
                {
                    "key": key,
                    "names": names,
                    "weight": float(ing.get("weight") or 0),
                }
            )

        catalog.append(
            {
                "source_url": source_url or None,
                "names": {"pl": pl_name, "en": en_name},
                "category": recipe.get("category"),
                "notes": recipe.get("notes"),
                "image_url": recipe.get("image_url"),
                "ingredients": ingredients_out,
            }
        )
    return catalog


def _product_key_by_pl_name(catalog_products: list[dict]) -> dict[str, str]:
    out: dict[str, str] = {}
    for entry in catalog_products:
        pl_name = (entry.get("names") or {}).get("pl") or ""
        if pl_name:
            out[normalize_product_name(pl_name)] = entry["key"]
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Build canonical + per-lang catalog seeds")
    parser.add_argument(
        "--from-exports",
        action="store_true",
        help="Rebuild canonical JSON from current PL export files + scraper EN data",
    )
    parser.add_argument("--pl-products", type=Path)
    parser.add_argument("--pl-recipes", type=Path)
    args = parser.parse_args()

    repo_root = runtime_data_root().parent.parent
    out_dir = seeds_dir()
    out_dir.mkdir(parents=True, exist_ok=True)

    if args.from_exports:
        pl_products_path = args.pl_products or out_dir / "products_seed_pl.json"
        pl_recipes_path = args.pl_recipes or out_dir / "recipes_seed_pl.json"
        macros_by_pl, _ = _load_macros(repo_root)
        en_db = _load_en_ingredient_db(repo_root)
        scraper_by_url = _load_scraper_recipes(repo_root)

        products_catalog = build_products_catalog(
            _load_json(pl_products_path), macros_by_pl, en_db
        )
        product_key_by_pl_name = _product_key_by_pl_name(products_catalog)
        recipes_catalog = build_recipes_catalog(
            _load_json(pl_recipes_path),
            scraper_by_url,
            product_key_by_pl_name,
            products_catalog,
        )

        (out_dir / "catalog_products.json").write_text(
            json.dumps(products_catalog, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        (out_dir / "catalog_recipes.json").write_text(
            json.dumps(recipes_catalog, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"Wrote canonical: {len(products_catalog)} products, {len(recipes_catalog)} recipes")
    else:
        products_catalog = _load_json(out_dir / "catalog_products.json")
        recipes_catalog = _load_json(out_dir / "catalog_recipes.json")
        if not products_catalog:
            raise SystemExit("Missing catalog_products.json — run with --from-exports first")

    stats = write_lang_seed_files(out_dir, products_catalog, recipes_catalog)
    for lang, counts in stats.items():
        print(
            f"  {lang}: {counts['products']} products, {counts['recipes']} recipes "
            f"→ products_seed_{lang}.json, recipes_seed_{lang}.json"
        )


if __name__ == "__main__":
    main()
