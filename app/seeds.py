"""
Seed default products and recipes for new users.

Generate seed files after scraping:
  cd scraper && python dump_seed.py

If a seed file doesn't exist, new users start with an empty list.
"""

import json
from pathlib import Path

from app import db
from app.models.product import Product
from app.models.recipe import Recipe, RecipeIngredient

DATA_DIR = Path(__file__).parent / "data"


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


def seed_user(user_id: int, lang: str = "pl"):
    """Create default products and recipes for a new user."""
    _seed_products(user_id, lang)
    _seed_recipes(user_id, lang)


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

    # Build name→id map from newly seeded products
    product_map: dict[str, int] = {
        p.name.lower(): p.id
        for p in Product.query.filter_by(user_id=user_id).all()
    }

    for r in recipes:
        name = (r.get("name") or "").strip()
        if not name:
            continue

        recipe = Recipe(
            user_id=user_id,
            name=name,
            notes=r.get("notes"),
            image_url=r.get("image_url"),
            source_url=r.get("source_url"),
            category=r.get("category"),
            lang=lang,
            kcal_100g=r.get("kcal_100g"),
            protein_100g=r.get("protein_100g"),
            fat_100g=r.get("fat_100g"),
            carbs_100g=r.get("carbs_100g"),
        )
        db.session.add(recipe)
        db.session.flush()  # get recipe.id before inserting ingredients

        for ing in r.get("ingredients", []):
            pname = (ing.get("product_name") or "").strip().lower()
            weight = float(ing.get("weight") or 1)
            product_id = product_map.get(pname)
            if not product_id:
                # Create placeholder if the product is not in the catalogue
                placeholder = Product(
                    user_id=user_id,
                    name=ing["product_name"].strip()[:200],
                    price=0, package_weight=100, unit="g", sold_by_weight=False,
                )
                db.session.add(placeholder)
                db.session.flush()
                product_id = placeholder.id
                product_map[pname] = product_id

            db.session.add(RecipeIngredient(
                recipe_id=recipe.id,
                product_id=product_id,
                weight=weight,
            ))

    db.session.commit()
