"""
Importuje catalogue.json do bazy produktów.

1. Zapisuje obecne składniki przepisów (nazwa + waga)
2. Usuwa wszystkie produkty użytkownika
3. Wstawia produkty z katalogu (makra = NULL, wypełni fill_macros)
4. Przepina recipe_ingredients na nowe ID

Użycie:
    python import_catalogue.py --dry-run
    python import_catalogue.py --apply --user-id 2
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

# Ręczne dopasowania gdy stara nazwa nie istnieje w katalogu
# stara_nazwa → nowa_nazwa_z_katalogu
FALLBACK_MAP = {
    "Pierś":    "Filet z kurczaka",
    "Oliwa":    "Oliwa z oliwek",
    "Bulion":   "Bulion drobiowy",
    "Pieprz":   "Pieprz czarny",
    "Papryka":  "Papryka słodka",
    "Płatki":   "Płatki owsiane",
}


def get_conn():
    return psycopg2.connect(**DB_CONFIG)


def load_catalogue(path: str) -> list[dict]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def save_recipe_ingredients(conn, user_id: int) -> list[dict]:
    """Zwraca listę składników przepisów z nazwami produktów."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT ri.id, ri.recipe_id, ri.weight, p.name AS product_name
            FROM recipe_ingredients ri
            JOIN products p ON p.id = ri.product_id
            WHERE p.user_id = %s
        """, (user_id,))
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def find_catalogue_match(old_name: str, catalogue_names: list[str]) -> str | None:
    """Zwraca nazwę z katalogu pasującą do starej nazwy."""
    # 1. Dokładne dopasowanie
    if old_name in catalogue_names:
        return old_name
    # 2. Ręczny fallback
    if old_name in FALLBACK_MAP:
        fallback = FALLBACK_MAP[old_name]
        if fallback in catalogue_names:
            return fallback
    # 3. Częściowe (stara nazwa zawiera się w nowej lub odwrotnie)
    lower = old_name.lower()
    for name in catalogue_names:
        if lower in name.lower() or name.lower() in lower:
            return name
    return None


def run(conn, user_id: int, catalogue: list[dict], dry_run: bool):
    print(f"\n=== {'DRY RUN — ' if dry_run else ''}Import katalogu ===")
    print(f"Produkty w katalogu: {len(catalogue)}")

    # 1. Zapisz obecne składniki przepisów
    saved_ings = save_recipe_ingredients(conn, user_id)
    print(f"Składniki przepisów do przepięcia: {len(saved_ings)}")

    cat_names = [e["name"] for e in catalogue]

    # Pokaż plan przepięcia składników
    print("\nPlan przepięcia składników:")
    remap = {}
    for ing in saved_ings:
        old = ing["product_name"]
        if old in remap:
            continue
        new = find_catalogue_match(old, cat_names)
        remap[old] = new
        status = "✓" if new else "✗ BRAK DOPASOWANIA"
        arrow = f"→ {new}" if new else ""
        print(f"  {status}  {old:<20s} {arrow}")

    missing = [k for k, v in remap.items() if v is None]
    if missing:
        print(f"\nUWAGA: {len(missing)} składnik(ów) bez dopasowania: {missing}")
        print("Dodaj je do FALLBACK_MAP w skrypcie lub uzupełnij keywords.")
        if not dry_run:
            print("Przerywam — popraw fallback i uruchom ponownie.")
            return

    if dry_run:
        print("\n[DRY RUN] Nic nie zmieniono. Uruchom z --apply żeby zastosować.")
        return

    with conn.cursor() as cur:
        # 2. Usuń recipe_ingredients
        recipe_ids = list({i["recipe_id"] for i in saved_ings})
        if recipe_ids:
            cur.execute(
                "DELETE FROM recipe_ingredients WHERE recipe_id = ANY(%s)",
                (recipe_ids,)
            )
            print(f"\nUsunięto {cur.rowcount} recipe_ingredients")

        # 3. Usuń stare produkty
        cur.execute("DELETE FROM products WHERE user_id = %s", (user_id,))
        print(f"Usunięto {cur.rowcount} starych produktów")

        # 4. Wstaw nowe produkty
        new_id_map: dict[str, int] = {}
        for entry in catalogue:
            pkg_weight = entry.get("package_weight") or 100
            price      = entry.get("price") or 0
            cur.execute("""
                INSERT INTO products
                    (user_id, name, package_weight, price, unit, sold_by_weight,
                     kcal, protein, fat, carbs)
                VALUES (%s, %s, %s, %s, %s, %s, NULL, NULL, NULL, NULL)
                RETURNING id
            """, (
                user_id,
                entry["name"],
                pkg_weight,
                price,
                entry.get("unit", "g"),
                bool(entry.get("sold_by_weight", False)),
            ))
            new_id_map[entry["name"]] = cur.fetchone()[0]

        print(f"Wstawiono {len(new_id_map)} nowych produktów")

        # 5. Przywróć recipe_ingredients z nowymi ID
        restored = 0
        skipped  = 0
        for ing in saved_ings:
            new_name = remap.get(ing["product_name"])
            if not new_name or new_name not in new_id_map:
                print(f"  POMINIĘTO składnik: {ing['product_name']} (brak w nowym katalogu)")
                skipped += 1
                continue
            cur.execute("""
                INSERT INTO recipe_ingredients (recipe_id, product_id, weight)
                VALUES (%s, %s, %s)
            """, (ing["recipe_id"], new_id_map[new_name], ing["weight"]))
            restored += 1

        print(f"Przywrócono {restored} składników przepisów")
        if skipped:
            print(f"Pominięto {skipped} składników (brak dopasowania)")

    conn.commit()
    print("\nGotowe. Uruchom fill_macros.py żeby uzupełnić makroskładniki.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", default=True)
    parser.add_argument("--apply",   action="store_true")
    parser.add_argument("--user-id", type=int, default=DEFAULT_USER_ID)
    parser.add_argument("--catalogue", default="catalogue.json")
    args = parser.parse_args()

    dry_run   = not args.apply
    conn      = get_conn()
    catalogue = load_catalogue(args.catalogue)

    run(conn, args.user_id, catalogue, dry_run=dry_run)
    conn.close()


if __name__ == "__main__":
    main()
