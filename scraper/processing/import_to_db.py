#!/usr/bin/env python3
"""
Importuje przepisy i produkty z pipeline'u do bazy danych aplikacji.

Uruchomienie (przez Docker):
    docker exec mealprep-app-1 python /app/scraper/processing/import_to_db.py --user-id 2
    docker exec mealprep-app-1 python /app/scraper/processing/import_to_db.py --user-id 2 --lang pl
    docker exec mealprep-app-1 python /app/scraper/processing/import_to_db.py --list-users
    docker exec mealprep-app-1 python /app/scraper/processing/import_to_db.py --user-id 2 --clear
"""

import argparse
import json
import sys
from pathlib import Path

DATA = Path(__file__).parent.parent / "data"

# Bootstrap Flask app context
sys.path.insert(0, "/app")
from app import create_app, db
from app.models.product import Product
from app.models.recipe import Recipe, RecipeIngredient

app = create_app()


# ── Helpers ───────────────────────────────────────────────────────────────────

def load(filename: str) -> list:
    path = DATA / filename
    if not path.exists():
        print(f"Brak pliku: {path}")
        return []
    return json.loads(path.read_text("utf-8"))


def build_macro_map(macros: list, key: str) -> dict:
    """Buduje słownik name_en/name_pl → makro."""
    return {
        m[key]: {
            "kcal":    m.get("kcal"),
            "protein": m.get("protein_g"),
            "fat":     m.get("fat_g"),
            "carbs":   m.get("carbs_g"),
        }
        for m in macros if m.get(key)
    }


def unit_to_app(unit: str | None) -> str:
    """Konwertuje jednostkę pipeline → format aplikacji (pcs → szt)."""
    if unit == "pcs":
        return "szt"
    return unit or "g"


def convert_weight(amount: float | None, ing_unit: str | None, prod_unit: str) -> float | None:
    """Przelicza ilość składnika na jednostkę produktu."""
    if amount is None:
        return None
    iu = (ing_unit or "g").lower()
    pu = prod_unit.lower()
    # Zgodne jednostki lub g↔ml traktujemy 1:1
    if iu == pu or {iu, pu} <= {"g", "ml"}:
        return float(amount)
    # pcs/szt
    if iu in ("pcs", "szt") and pu == "szt":
        return float(amount)
    return float(amount)  # best-effort


# ── Import produktów ──────────────────────────────────────────────────────────

def import_products(user_id: int, lang: str) -> dict[str, int]:
    """Importuje produkty, zwraca mapę nazwa.lower() → product_id."""
    if lang == "en":
        db_file   = "ingredient_db_en.json"
        macro_key = "name_en"
        currency  = "GBP"
    else:
        db_file   = "ingredient_db_pl.json"
        macro_key = "name_pl"
        currency  = "PLN"

    ingredients = load(db_file)
    macros_raw  = load("ingredients_macros.json")
    macro_map   = build_macro_map(macros_raw, macro_key)

    added = 0
    product_map: dict[str, int] = {}

    for item in ingredients:
        name = item.get("ingredient_name", "").strip()
        if not name:
            continue

        price_per_100 = item.get("price_per_100")
        pkg_val       = item.get("package_size_value")
        unit          = unit_to_app(item.get("unit"))
        sold_by_wt    = bool(item.get("sold_by_weight", False))
        macro         = macro_map.get(name, {})

        prod = Product(
            user_id       = user_id,
            name          = name,
            price         = round(float(price_per_100), 4) if price_per_100 else 0.0,
            package_weight= round(float(pkg_val), 1)      if pkg_val        else 100.0,
            unit          = unit,
            sold_by_weight= sold_by_wt,
            kcal          = macro.get("kcal"),
            protein       = macro.get("protein"),
            fat           = macro.get("fat"),
            carbs         = macro.get("carbs"),
        )
        db.session.add(prod)
        db.session.flush()
        product_map[name.lower()] = prod.id
        added += 1

    db.session.commit()
    print(f"  Produkty ({lang.upper()}): dodano {added}")
    return product_map


# ── Import przepisów ──────────────────────────────────────────────────────────

def import_recipes(user_id: int, lang: str, product_map: dict[str, int]):
    if lang == "en":
        recipes_file = "recipes_en.json"
        name_key     = "name_en"
        ing_key      = "ingredients_en"
    else:
        recipes_file = "recipes_pl.json"
        name_key     = "name_pl"
        ing_key      = "ingredients_pl"

    recipes = load(recipes_file)
    added = skipped = placeholder_count = 0

    for r in recipes:
        name = (r.get(name_key) or "").strip()
        if not name:
            skipped += 1
            continue

        recipe = Recipe(
            user_id   = user_id,
            name      = name[:100],
            image_url = r.get("image_url"),
            source_url= r.get("url"),
        )
        db.session.add(recipe)
        db.session.flush()

        for ing in r.get(ing_key, []):
            ing_name = (ing.get("name") or "").strip().lower()
            amount   = ing.get("amount")
            unit     = ing.get("unit")

            prod_id = product_map.get(ing_name)

            if not prod_id:
                # Utwórz placeholder
                placeholder = Product(
                    user_id=user_id, name=ing_name[:200],
                    price=0, package_weight=100, unit="g", sold_by_weight=False,
                )
                db.session.add(placeholder)
                db.session.flush()
                product_map[ing_name] = placeholder.id
                prod_id = placeholder.id
                placeholder_count += 1

            prod_unit = db.session.get(Product, prod_id).unit or "g"
            weight    = convert_weight(amount, unit, prod_unit)
            if weight is None or weight <= 0:
                weight = 1.0

            db.session.add(RecipeIngredient(
                recipe_id  = recipe.id,
                product_id = prod_id,
                weight     = weight,
            ))

        added += 1

    db.session.commit()
    print(f"  Przepisy ({lang.upper()}): dodano {added}, pominięto {skipped}, "
          f"placeholdery {placeholder_count}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="Import pipeline → DB")
    ap.add_argument("--user-id",     type=int, default=None)
    ap.add_argument("--lang",        default="en", choices=["en", "pl"])
    ap.add_argument("--clear",       action="store_true",
                    help="Usuń istniejące produkty i przepisy użytkownika przed importem")
    ap.add_argument("--list-users",  action="store_true")
    args = ap.parse_args()

    with app.app_context():
        if args.list_users:
            from app.models.user import User
            for u in User.query.all():
                prods   = Product.query.filter_by(user_id=u.id).count()
                recipes = Recipe.query.filter_by(user_id=u.id).count()
                print(f"  id={u.id}  {u.email:<35}  {prods} produktów, {recipes} przepisów")
            return

        if not args.user_id:
            print("Podaj --user-id N lub --list-users")
            sys.exit(1)

        uid = args.user_id

        if args.clear:
            r_count = Recipe.query.filter_by(user_id=uid).count()
            p_count = Product.query.filter_by(user_id=uid).count()
            # Kolejność: najpierw recipe_ingredients (FK), potem recipes, potem products
            recipe_ids = [r.id for r in Recipe.query.filter_by(user_id=uid).all()]
            if recipe_ids:
                RecipeIngredient.query.filter(
                    RecipeIngredient.recipe_id.in_(recipe_ids)
                ).delete(synchronize_session=False)
            Recipe.query.filter_by(user_id=uid).delete()
            Product.query.filter_by(user_id=uid).delete()
            db.session.commit()
            print(f"Usunięto: {r_count} przepisów, {p_count} produktów")

        print(f"Importuję dla user_id={uid}, lang={args.lang}...")
        product_map = import_products(uid, args.lang)
        import_recipes(uid, args.lang, product_map)
        print("Gotowe!")


if __name__ == "__main__":
    main()
