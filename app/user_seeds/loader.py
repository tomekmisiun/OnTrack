"""
Seed default products and recipes for new users.

Generate seed files after scraping:
  cd scraper && python pipeline/dump_seeds.py

Production loads only app/user_seeds/data/*.json — no runtime pipeline import.
"""

from __future__ import annotations

import json
from pathlib import Path

from app import db
from app.models.product import Product
from app.models.recipe import Recipe, RecipeIngredient
from app.paths import USER_SEEDS_DIR
from app.pexels import is_source_recipe_image


def _load_json(fname: str, lang: str) -> list[dict]:
    """Load seed file for the given language, fall back to PL."""
    for name in (fname.replace("_pl.", f"_{lang}."), fname):
        path = USER_SEEDS_DIR / name
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                if isinstance(data, list) and data:
                    return data
            except Exception:
                pass
    return []


def backfill_recipe_images(user_id: int, lang: str) -> int:
    """Set image_url from seed JSON for recipes missing thumbnails."""
    seed_path = USER_SEEDS_DIR / f"recipes_seed_{lang}.json"
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
    """Load catalog from app/user_seeds/data/*.json."""
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
                continue

            db.session.add(RecipeIngredient(
                recipe_id=recipe.id,
                product_id=product_id,
                weight=weight,
            ))

    db.session.commit()
