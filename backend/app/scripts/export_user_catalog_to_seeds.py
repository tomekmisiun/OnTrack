"""MIGRATION-ONLY: export a user's catalog to JSON snapshot files.

This script requires a live database and a specific user account.
It is NOT part of the standard catalog rebuild workflow.

For normal operations, edit ``backend/data/canonical/`` and run ``build_catalog``.

One-time owner snapshot is already stored in ``raw/user_1_catalog_snapshot/``.

Usage (admin / migration):
  uv run python -m app.scripts.export_user_catalog_to_seeds --user-id 1 --lang pl
  uv run python -m app.scripts.export_user_catalog_to_seeds --username tomek --lang pl
  uv run python -m app.scripts.export_user_catalog_to_seeds --list-users
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from sqlalchemy.orm import Session, joinedload

from app.core.runtime_data import seeds_dir
from app.db.session import get_session_factory
from app.domain.market import catalog_lang_for_market
from app.models.product import Product
from app.models.recipe import Recipe, RecipeIngredient
from app.models.user import User


def _product_row(product: Product) -> dict:
    return {
        "name": product.name,
        "price": float(product.price),
        "package_weight": float(product.package_weight),
        "unit": product.unit or "g",
        "sold_by_weight": bool(product.sold_by_weight),
        "kcal": product.kcal,
        "protein": product.protein,
        "fat": product.fat,
        "carbs": product.carbs,
    }


def _recipe_row(recipe: Recipe) -> dict:
    ingredients: list[dict] = []
    for ing in recipe.ingredients:
        if not ing.product:
            continue
        ingredients.append(
            {
                "product_name": ing.product.name,
                "weight": float(ing.weight),
            }
        )
    row: dict = {
        "name": recipe.name,
        "category": recipe.category,
        "notes": recipe.notes,
        "image_url": recipe.image_url,
        "source_url": recipe.source_url,
        "ingredients": ingredients,
    }
    if recipe.kcal_100g is not None:
        row["kcal_100g"] = recipe.kcal_100g
        row["protein_100g"] = recipe.protein_100g
        row["fat_100g"] = recipe.fat_100g
        row["carbs_100g"] = recipe.carbs_100g
    return row


def _visible_products_for_user(session: Session, user: User, lang: str) -> list[Product]:
    """User-owned products plus system catalog for lang (deduped by name, user wins)."""
    by_name: dict[str, Product] = {}
    for product in (
        session.query(Product)
        .filter(Product.user_id.is_(None), Product.source == "system", Product.lang == lang)
        .order_by(Product.name)
    ):
        by_name[product.name.lower()] = product
    for product in (
        session.query(Product)
        .filter_by(user_id=user.id, lang=lang)
        .order_by(Product.name)
    ):
        by_name[product.name.lower()] = product
    return sorted(by_name.values(), key=lambda p: p.name.lower())


def export_user_catalog(
    session: Session,
    user: User,
    lang: str,
    *,
    out_dir: Path | None = None,
) -> tuple[int, int]:
    out = out_dir or seeds_dir()
    out.mkdir(parents=True, exist_ok=True)

    products = [_product_row(p) for p in _visible_products_for_user(session, user, lang)]
    recipes_q = (
        session.query(Recipe)
        .options(joinedload(Recipe.ingredients).joinedload(RecipeIngredient.product))
        .filter_by(user_id=user.id, lang=lang)
        .order_by(Recipe.name)
    )
    recipes = [_recipe_row(r) for r in recipes_q]

    products_path = out / f"products_seed_{lang}.json"
    recipes_path = out / f"recipes_seed_{lang}.json"
    products_path.write_text(json.dumps(products, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    recipes_path.write_text(json.dumps(recipes, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return len(products), len(recipes)


def list_users(session: Session) -> None:
    for user in session.query(User).order_by(User.id):
        lang = catalog_lang_for_market(user.market_code or "PL")
        own_p = session.query(Product).filter_by(user_id=user.id, lang=lang).count()
        sys_p = session.query(Product).filter(
            Product.user_id.is_(None), Product.source == "system", Product.lang == lang
        ).count()
        recipes = session.query(Recipe).filter_by(user_id=user.id, lang=lang).count()
        label = user.username or user.email
        print(
            f"id={user.id}  {label:<40}  market={user.market_code}  "
            f"own_products={own_p}  system_{lang}={sys_p}  recipes_{lang}={recipes}"
        )


def resolve_user(session: Session, user_id: int | None, username: str | None) -> User:
    if user_id is not None:
        user = session.get(User, user_id)
        if not user:
            raise SystemExit(f"User id={user_id} not found")
        return user
    if username:
        user = session.query(User).filter_by(username=username.lower().strip()).first()
        if not user:
            user = session.query(User).filter(User.email.ilike(username)).first()
        if not user:
            raise SystemExit(f"User {username!r} not found")
        return user
    raise SystemExit("Provide --user-id or --username")


def main() -> None:
    parser = argparse.ArgumentParser(description="Export user catalog to seed JSON files")
    parser.add_argument("--user-id", type=int)
    parser.add_argument("--username")
    parser.add_argument("--lang", default="pl", choices=("pl", "en"))
    parser.add_argument("--out-dir", type=Path, help="Defaults to backend/data/seeds")
    parser.add_argument("--list-users", action="store_true")
    args = parser.parse_args()

    session = get_session_factory()()
    try:
        if args.list_users:
            list_users(session)
            return

        user = resolve_user(session, args.user_id, args.username)
        n_products, n_recipes = export_user_catalog(
            session, user, args.lang, out_dir=args.out_dir
        )
        out = args.out_dir or seeds_dir()
        print(
            f"Exported user id={user.id} ({user.username or user.email}) "
            f"lang={args.lang}: {n_products} products, {n_recipes} recipes → {out}"
        )
    finally:
        session.close()


if __name__ == "__main__":
    main()
