from __future__ import annotations

import json

from sqlalchemy.orm import Session

from app.core.runtime_data import seeds_dir
from app.domain.product_normalize import normalize_product_name
from app.models.product import Product
from app.models.recipe import Recipe, RecipeIngredient


def _load_json(fname: str, lang: str) -> list[dict]:
    base = seeds_dir()
    for name in (fname.replace("_pl.", f"_{lang}."), fname):
        path = base / name
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                if isinstance(data, list) and data:
                    return data
            except Exception:
                pass
    return []


def _catalog_incomplete(session: Session, user_id: int, lang: str) -> bool:
    has_products = (
        session.query(Product)
        .filter_by(user_id=user_id, lang=lang)
        .filter(Product.price > 0)
        .first()
    )
    has_recipes = session.query(Recipe).filter_by(user_id=user_id, lang=lang).first()
    return not has_products or not has_recipes


def _seed_products(session: Session, user_id: int, lang: str) -> None:
    products = _load_json("products_seed_pl.json", lang)
    if not products:
        return
    for p in products:
        name = (p.get("name") or "").strip()[:200]
        if not name:
            continue
        session.add(
            Product(
                user_id=user_id,
                source="legacy",
                normalized_name=normalize_product_name(name),
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
            )
        )
    session.commit()


def _seed_recipes(session: Session, user_id: int, lang: str) -> None:
    recipes = _load_json("recipes_seed_pl.json", lang)
    if not recipes:
        return

    product_map = {
        p.name.lower(): p.id
        for p in session.query(Product).filter_by(user_id=user_id, lang=lang).all()
    }
    existing_names = {
        r.name.lower() for r in session.query(Recipe).filter_by(user_id=user_id, lang=lang).all()
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
        session.add(recipe)
        session.flush()

        for ing in r.get("ingredients", []):
            pname = (ing.get("product_name") or "").strip().lower()
            weight = float(ing.get("weight") or 1)
            product_id = product_map.get(pname)
            if not product_id:
                continue
            session.add(
                RecipeIngredient(
                    recipe_id=recipe.id,
                    product_id=product_id,
                    weight=weight,
                )
            )

    session.commit()


def ensure_user_seeded(session: Session, user_id: int, lang: str) -> None:
    if (
        not session.query(Product)
        .filter_by(user_id=user_id, lang=lang)
        .filter(Product.price > 0)
        .first()
    ):
        _seed_products(session, user_id, lang)
    if not session.query(Recipe).filter_by(user_id=user_id, lang=lang).first():
        _seed_recipes(session, user_id, lang)


def ensure_catalog_if_incomplete(session: Session, user_id: int, lang: str) -> None:
    if _catalog_incomplete(session, user_id, lang):
        ensure_user_seeded(session, user_id, lang)
