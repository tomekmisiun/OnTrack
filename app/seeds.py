"""
Seed default products and recipes for new users.

Generate seed files after scraping (includes Pexels thumbnails):
  cd scraper && python processing/dump_seeds.py

Production loads only app/data/*.json — no runtime pipeline import.
"""

import json
import subprocess
import sys
from pathlib import Path

from app import db
from app.models.product import Product
from app.models.recipe import Recipe, RecipeIngredient
from app.pexels import is_source_recipe_image
from app.utils import looks_like_recipe_ingredient_line

DATA_DIR = Path(__file__).parent / "data"
SCRAPER_DATA = Path(__file__).parent.parent / "scraper" / "data"
IMPORT_SCRIPT = Path(__file__).parent.parent / "scraper" / "processing" / "import_to_db.py"


def _load_json(fname: str, lang: str) -> list[dict]:
    """Load seed file for the given language, fall back to PL."""
    for name in (fname.replace("_pl.", f"_{lang}."), fname):
        path = DATA_DIR / name
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                if isinstance(data, list) and data:
                    return data
            except Exception:
                pass
    return []


def _pipeline_available(lang: str) -> bool:
    return (
        (SCRAPER_DATA / f"ingredient_db_{lang}.json").exists()
        and (SCRAPER_DATA / f"recipes_{lang}.json").exists()
        and IMPORT_SCRIPT.exists()
    )


def _placeholder_count(user_id: int, lang: str) -> int:
    return Product.query.filter_by(user_id=user_id, lang=lang, price=0).count()


def _catalog_product_count(user_id: int, lang: str) -> int:
    return Product.query.filter_by(user_id=user_id, lang=lang).filter(Product.price > 0).count()


def _recipes_missing_categories(user_id: int, lang: str) -> bool:
    recipes = Recipe.query.filter_by(user_id=user_id, lang=lang).all()
    if not recipes:
        return False
    with_cat = sum(1 for r in recipes if r.category)
    return with_cat / len(recipes) < 0.3


def _bad_product_names(user_id: int, lang: str) -> int:
    return sum(
        1 for p in Product.query.filter_by(user_id=user_id, lang=lang).all()
        if looks_like_recipe_ingredient_line(p.name)
    )


def _long_named_products(user_id: int, lang: str) -> bool:
    products = Product.query.filter_by(user_id=user_id, lang=lang).all()
    if not products:
        return False
    long_count = sum(1 for p in products if len(p.name or "") > 35)
    return long_count / len(products) > 0.4


def _missing_macro_products(user_id: int, lang: str) -> bool:
    products = Product.query.filter_by(user_id=user_id, lang=lang).all()
    if len(products) < 20:
        return False
    missing = sum(1 for p in products if p.kcal is None)
    return missing / len(products) > 0.25


def catalog_needs_repair(user_id: int, lang: str) -> bool:
    """Detect broken catalog: placeholder products dominate or categories missing."""
    if not Product.query.filter_by(user_id=user_id, lang=lang).first():
        return False
    if _bad_product_names(user_id, lang) > 0:
        return True
    if _long_named_products(user_id, lang):
        return True
    if _missing_macro_products(user_id, lang):
        return True
    placeholders = _placeholder_count(user_id, lang)
    catalog = _catalog_product_count(user_id, lang)
    if placeholders > catalog:
        return True
    if _recipes_missing_categories(user_id, lang):
        return True
    return False


def import_lang_from_pipeline(user_id: int, lang: str, replace: bool = False) -> bool:
    """Import products + recipes using scraper pipeline data."""
    if not _pipeline_available(lang):
        return False
    cmd = [sys.executable, str(IMPORT_SCRIPT), "--user-id", str(user_id), "--lang", lang]
    if replace:
        cmd.extend(["--clear-lang", lang])
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        print(result.stderr or result.stdout)
        return False
    return True


def backfill_recipe_images(user_id: int, lang: str) -> int:
    """Set image_url from seed JSON for recipes missing thumbnails."""
    seed_path = DATA_DIR / f"recipes_seed_{lang}.json"
    if not seed_path.exists():
        return 0

    raw = json.loads(seed_path.read_text(encoding="utf-8"))
    by_source = {
        (r.get("source_url") or "").strip(): r.get("image_url")
        for r in raw if r.get("image_url")
    }
    by_name = {
        (r.get("name") or "").strip().lower(): r.get("image_url")
        for r in raw if r.get("image_url")
    }

    updated = 0
    for recipe in Recipe.query.filter_by(user_id=user_id, lang=lang).all():
        if recipe.image_url and not is_source_recipe_image(recipe.image_url):
            continue
        url = by_source.get((recipe.source_url or "").strip())
        if not url:
            url = by_name.get(recipe.name.strip().lower())
        if url and url != recipe.image_url:
            recipe.image_url = url
            updated += 1

    if updated:
        db.session.commit()
    return updated


def seed_user(user_id: int, lang: str = "pl"):
    """Create default products and recipes for a new user from JSON seed files."""
    ensure_user_seeded(user_id, lang)


def ensure_user_seeded(user_id: int, lang: str):
    """Load catalog from app/data/*.json — no runtime pipeline import."""
    if not Product.query.filter_by(user_id=user_id, lang=lang).filter(Product.price > 0).first():
        _seed_products(user_id, lang)
    if not Recipe.query.filter_by(user_id=user_id, lang=lang).first():
        _seed_recipes(user_id, lang)
    backfill_recipe_images(user_id, lang)


def _seed_products(user_id: int, lang: str):
    products = _load_json("products_seed_pl.json", lang)
    if not products:
        return

    for p in products:
        name = (p.get("name") or "").strip()[:200]
        if not name:
            continue
        db.session.add(Product(
            user_id=user_id,
            name=name,
            price=float(p.get("price") or 0),
            package_weight=float(p.get("package_weight") or 100),
            unit=p.get("unit") or "g",
            sold_by_weight=bool(p.get("sold_by_weight", False)),
            kcal=p.get("kcal"),
            protein=p.get("protein"),
            fat=p.get("fat"),
            carbs=p.get("carbs"),
            lang=lang,
        ))
    db.session.commit()


def _seed_recipes(user_id: int, lang: str):
    recipes = _load_json("recipes_seed_pl.json", lang)
    if not recipes:
        return

    product_map: dict[str, int] = {
        p.name.lower(): p.id
        for p in Product.query.filter_by(user_id=user_id, lang=lang).all()
    }
    existing_names = {
        r.name.lower()
        for r in Recipe.query.filter_by(user_id=user_id, lang=lang).all()
    }
    seen_names: set[str] = set()

    for r in recipes:
        name = (r.get("name") or "").strip()
        if not name:
            continue
        name_key = name.lower()
        if name_key in existing_names or name_key in seen_names:
            continue
        seen_names.add(name_key)

        raw_cat = r.get("category") or ""
        category = {"snacks": "snack", "desserts": "dessert"}.get(raw_cat, raw_cat) or None

        recipe = Recipe(
            user_id=user_id,
            name=name,
            notes=r.get("notes"),
            image_url=r.get("image_url"),
            source_url=r.get("source_url"),
            category=category,
            lang=lang,
            kcal_100g=r.get("kcal_100g"),
            protein_100g=r.get("protein_100g"),
            fat_100g=r.get("fat_100g"),
            carbs_100g=r.get("carbs_100g"),
        )
        db.session.add(recipe)
        db.session.flush()

        for ing in r.get("ingredients", []):
            pname = (ing.get("product_name") or "").strip().lower()
            weight = float(ing.get("weight") or 1)
            product_id = product_map.get(pname)
            if not product_id:
                continue  # skip unmatched — do not create placeholder products

            db.session.add(RecipeIngredient(
                recipe_id=recipe.id,
                product_id=product_id,
                weight=weight,
            ))

    db.session.commit()
