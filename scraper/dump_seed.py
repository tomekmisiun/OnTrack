"""
Eksportuje produkty i przepisy z bazy (user_id=2) do plików seed aplikacji.
Nowi użytkownicy dostaną te same produkty i przepisy przy zakładaniu konta.

Użycie:
    python dump_seed.py
    python dump_seed.py --user-id 2
"""

import argparse
import json
import psycopg2
from pathlib import Path

DB_CONFIG = {
    "host":     "localhost",
    "port":     5432,
    "dbname":   "mealplanner",
    "user":     "user",
    "password": "password",
}
DEFAULT_USER_ID = 2
DATA_DIR = Path(__file__).parent.parent / "app" / "data"


def get_conn():
    return psycopg2.connect(**DB_CONFIG)


def dump_products(conn, user_id: int) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute("""
            SELECT name, package_weight, price, unit, sold_by_weight,
                   kcal, protein, fat, carbs
            FROM products WHERE user_id = %s ORDER BY name
        """, (user_id,))
        rows = cur.fetchall()

    products = []
    for name, pkg_weight, price, unit, sbw, kcal, protein, fat, carbs in rows:
        entry = {
            "name":           name,
            "package_weight": pkg_weight,
            "price":          price,
            "unit":           unit,
            "sold_by_weight": bool(sbw),
        }
        if kcal    is not None: entry["kcal"]    = round(float(kcal),    1)
        if protein is not None: entry["protein"] = round(float(protein), 1)
        if fat     is not None: entry["fat"]     = round(float(fat),     1)
        if carbs   is not None: entry["carbs"]   = round(float(carbs),   1)
        products.append(entry)
    return products


def dump_recipes(conn, user_id: int) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute("""
            SELECT r.id, r.name, r.notes, r.image_url, r.source_url,
                   r.kcal_100g, r.protein_100g, r.fat_100g, r.carbs_100g
            FROM recipes r
            WHERE r.user_id = %s
            ORDER BY r.name
        """, (user_id,))
        recipe_rows = cur.fetchall()

    recipes = []
    for rid, name, notes, image_url, source_url, k, pr, fa, ca in recipe_rows:
        with conn.cursor() as cur2:
            cur2.execute("""
                SELECT p.name, ri.weight
                FROM recipe_ingredients ri
                JOIN products p ON p.id = ri.product_id
                WHERE ri.recipe_id = %s
            """, (rid,))
            ingredients = [{"product_name": row[0], "weight": row[1]}
                           for row in cur2.fetchall()]

        entry = {"name": name, "ingredients": ingredients}
        if notes:      entry["notes"]      = notes
        if image_url:  entry["image_url"]  = image_url
        if source_url: entry["source_url"] = source_url
        if k  is not None: entry["kcal_100g"]    = k
        if pr is not None: entry["protein_100g"] = pr
        if fa is not None: entry["fat_100g"]     = fa
        if ca is not None: entry["carbs_100g"]   = ca
        recipes.append(entry)
    return recipes


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--user-id", type=int, default=DEFAULT_USER_ID)
    args = parser.parse_args()

    conn = get_conn()
    products = dump_products(conn, args.user_id)
    recipes  = dump_recipes(conn, args.user_id)
    conn.close()

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    prod_path = DATA_DIR / "products_seed_pl.json"
    prod_path.write_text(json.dumps(products, ensure_ascii=False, indent=2), encoding="utf-8")
    with_macros = sum(1 for p in products if "kcal" in p)
    print(f"Produktów: {len(products)}  (z makrami: {with_macros})  → {prod_path}")

    rec_path = DATA_DIR / "recipes_seed_pl.json"
    rec_path.write_text(json.dumps(recipes, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Przepisów:  {len(recipes)}  → {rec_path}")


if __name__ == "__main__":
    main()
