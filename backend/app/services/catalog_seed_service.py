from __future__ import annotations

import json

from sqlalchemy.orm import Session

from app.core.runtime_data import seeds_dir
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
    return not session.query(Recipe).filter_by(user_id=user_id, lang=lang).first()


def _product_lookup_map(session: Session, user_id: int, lang: str) -> dict[str, int]:
    """Resolve ingredient names to product ids: user-owned rows override system catalog."""
    product_map: dict[str, int] = {}
    for product in session.query(Product).filter(
        Product.lang == lang,
        Product.user_id.is_(None),
        Product.source == "system",
    ):
        product_map[product.name.lower()] = product.id
    for product in session.query(Product).filter_by(user_id=user_id, lang=lang):
        product_map[product.name.lower()] = product.id
    return product_map


def _seed_recipes(session: Session, user_id: int, lang: str) -> None:
    recipes = _load_json("recipes_seed_pl.json", lang)
    if not recipes:
        return

    product_map = _product_lookup_map(session, user_id, lang)
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


def _ensure_global_catalog(session: Session, lang: str) -> None:
    has_system = (
        session.query(Product)
        .filter(
            Product.user_id.is_(None),
            Product.source == "system",
            Product.lang == lang,
        )
        .first()
    )
    if not has_system:
        from app.scripts.seed_global_catalog import import_global_catalog

        import_global_catalog(session, lang)


def ensure_user_seeded(session: Session, user_id: int, lang: str) -> None:
    _ensure_global_catalog(session, lang)
    if not session.query(Recipe).filter_by(user_id=user_id, lang=lang).first():
        _seed_recipes(session, user_id, lang)


def ensure_catalog_if_incomplete(session: Session, user_id: int, lang: str) -> None:
    if _catalog_incomplete(session, user_id, lang):
        ensure_user_seeded(session, user_id, lang)
