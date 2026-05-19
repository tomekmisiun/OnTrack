"""
Eksportuje produkty z bazy danych (user_id=2) do pliku seed aplikacji.
Nowi użytkownicy dostaną te same produkty przy zakładaniu konta.

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
SEED_PATH = Path(__file__).parent.parent / "app" / "data" / "products_seed_pl.json"


def get_conn():
    return psycopg2.connect(**DB_CONFIG)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--user-id", type=int, default=DEFAULT_USER_ID)
    args = parser.parse_args()

    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("""
            SELECT name, package_weight, price, unit, sold_by_weight,
                   kcal, protein, fat, carbs
            FROM products
            WHERE user_id = %s
            ORDER BY name
        """, (args.user_id,))
        rows = cur.fetchall()
    conn.close()

    products = []
    for name, pkg_weight, price, unit, sold_by_weight, kcal, protein, fat, carbs in rows:
        entry = {
            "name":           name,
            "package_weight": pkg_weight,
            "price":          price,
            "unit":           unit,
            "sold_by_weight": bool(sold_by_weight),
        }
        if kcal    is not None: entry["kcal"]    = round(float(kcal),    1)
        if protein is not None: entry["protein"] = round(float(protein), 1)
        if fat     is not None: entry["fat"]     = round(float(fat),     1)
        if carbs   is not None: entry["carbs"]   = round(float(carbs),   1)
        products.append(entry)

    with_macros = sum(1 for p in products if "kcal" in p)
    print(f"Produktów: {len(products)}  (z makrami: {with_macros})")

    SEED_PATH.parent.mkdir(parents=True, exist_ok=True)
    SEED_PATH.write_text(json.dumps(products, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Zapisano → {SEED_PATH}")


if __name__ == "__main__":
    main()
