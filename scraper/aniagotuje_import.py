"""
Import przepisów z aniagotuje_recipes.json do bazy danych Meal Planner.

Łączy się bezpośrednio z PostgreSQL (bez logowania), pobiera produkty
i dopasowuje składniki do nich po nazwie (fuzzy matching).

Użycie:
    # Podgląd — pokaż dopasowania bez zapisywania:
    python aniagotuje_import.py --dry-run

    # Importuj wszystkie przepisy z pliku JSON:
    python aniagotuje_import.py

    # Importuj tylko przepisy zawierające słowo w nazwie:
    python aniagotuje_import.py --search kurczak

    # Importuj tylko pierwsze N przepisów:
    python aniagotuje_import.py --limit 5

    # Pokaż listę użytkowników w bazie:
    python aniagotuje_import.py --list-users
"""

import re
import sys
import json
import argparse
from pathlib import Path

import psycopg2

INPUT_FILE = Path(__file__).parent / "aniagotuje_recipes.json"

DB_CONFIG = {
    "host":     "localhost",
    "port":     5432,
    "dbname":   "mealplanner",
    "user":     "user",
    "password": "password",
}

# Twój user_id z tabeli users (sprawdź: python aniagotuje_import.py --list-users)
DEFAULT_USER_ID = 2

MIN_MATCH_SCORE = 0.45  # Minimalne podobieństwo by uznać dopasowanie


def get_conn():
    return psycopg2.connect(**DB_CONFIG)


# ── Fuzzy matching ────────────────────────────────────────────────────────────

def normalize(text: str) -> str:
    t = text.lower().strip()
    for a, b in [("ą","a"),("ć","c"),("ę","e"),("ł","l"),
                 ("ń","n"),("ó","o"),("ś","s"),("ź","z"),("ż","z")]:
        t = t.replace(a, b)
    return re.sub(r"\s+", " ", t)


def word_overlap(a: str, b: str) -> float:
    words_a = set(normalize(a).split())
    words_b = set(normalize(b).split())
    if not words_a:
        return 0.0

    def stem_match(w1: str, w2: str) -> bool:
        if w1 == w2:
            return True
        # Porównuj pierwsze 5 znaków — obsługuje polską odmianę
        # "orzechow" i "orzechy" → "orzec" == "orzec" ✓
        # "ziemnych" i "ziemne"  → "ziemn" == "ziemn" ✓
        return len(w1) >= 5 and len(w2) >= 5 and w1[:5] == w2[:5]

    matched = sum(1 for wa in words_a if any(stem_match(wa, wb) for wb in words_b))
    return matched / len(words_a)


def find_best_product(ingredient_name: str, products: list[dict]) -> tuple[dict | None, float]:
    norm_ing = normalize(ingredient_name)
    best = None
    best_score = 0.0
    for p in products:
        norm_prod = normalize(p["name"])
        if norm_ing == norm_prod:
            return p, 1.0
        if norm_prod in norm_ing or norm_ing in norm_prod:
            score = 0.85
        else:
            score = word_overlap(norm_ing, norm_prod)
        if score > best_score:
            best_score = score
            best = p
    return best, best_score


def convert_weight(ilosc: float, jednostka: str, product: dict) -> float:
    """Przelicza ilość/jednostkę składnika na wagę w jednostce produktu."""
    unit = jednostka.lower()
    if unit == "kg":  return ilosc * 1000
    if unit == "l":   return ilosc * 1000
    if unit == "dl":  return ilosc * 100
    if unit in ("g", "ml"):
        return ilosc
    APPROX = {"łyżka": 15, "łyżeczka": 5, "szklanka": 240, "garść": 30, "szczypta": 2}
    if unit in APPROX:
        return ilosc * APPROX[unit]
    return ilosc  # szt lub nieznana — zwróć wprost


# ── Baza danych ───────────────────────────────────────────────────────────────

def list_users(conn) -> None:
    with conn.cursor() as cur:
        cur.execute("SELECT id, email FROM users ORDER BY id")
        rows = cur.fetchall()
    print("Użytkownicy w bazie:")
    for uid, email in rows:
        marker = " ← DEFAULT_USER_ID" if uid == DEFAULT_USER_ID else ""
        print(f"  id={uid}  {email}{marker}")
    print(f"\nZmień DEFAULT_USER_ID w aniagotuje_import.py jeśli potrzebujesz.")


def get_products(conn, user_id: int) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, name, unit, package_weight, price FROM products WHERE user_id = %s",
            (user_id,)
        )
        cols = ["id", "name", "unit", "package_weight", "price"]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def get_or_create_placeholder(conn, user_id: int, name: str) -> int:
    """Zwraca id istniejącego lub nowo stworzonego produktu-placeholder."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM products WHERE user_id=%s AND lower(name)=lower(%s) LIMIT 1",
            (user_id, name)
        )
        row = cur.fetchone()
        if row:
            return row[0]
        clean = name.strip().capitalize()
        cur.execute(
            "INSERT INTO products (user_id, name, package_weight, price, unit, sold_by_weight) "
            "VALUES (%s, %s, 100, 0, 'g', false) RETURNING id",
            (user_id, clean[:255])
        )
        return cur.fetchone()[0]


def recipe_exists(conn, user_id: int, name: str) -> bool:
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM recipes WHERE user_id = %s AND name = %s", (user_id, name))
        return cur.fetchone() is not None


def insert_recipe(conn, user_id: int, name: str, image_url: str,
                  source_url: str, notes: str, ingredients: list[dict],
                  kcal_100g=None, protein_100g=None,
                  fat_100g=None, carbs_100g=None) -> int:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO recipes "
            "(user_id, name, notes, image_url, source_url, is_favorite, "
            " kcal_100g, protein_100g, fat_100g, carbs_100g) "
            "VALUES (%s, %s, %s, %s, %s, false, %s, %s, %s, %s) RETURNING id",
            (user_id, name, notes or None, image_url or None, source_url or None,
             kcal_100g, protein_100g, fat_100g, carbs_100g)
        )
        recipe_id = cur.fetchone()[0]
        for ing in ingredients:
            cur.execute(
                "INSERT INTO recipe_ingredients (recipe_id, product_id, weight) VALUES (%s, %s, %s)",
                (recipe_id, ing["product_id"], ing["weight"])
            )
    conn.commit()
    return recipe_id


# ── Przetwarzanie przepisu ────────────────────────────────────────────────────

def process_recipe(recipe: dict, products: list[dict], conn,
                   user_id: int, dry_run: bool) -> bool:
    name = recipe["name"]
    prefix = "[DRY RUN] " if dry_run else ""
    print(f"\n{prefix}{name}")

    if not dry_run and recipe_exists(conn, user_id, name):
        print("  Już istnieje — pomijam.")
        return False

    lines = recipe["ingredients_csv"].splitlines()
    if len(lines) < 2 or "nazwa" not in lines[0]:
        print("  Brak składników — pomijam.")
        return False

    matched_ings = []
    unmatched = []

    for line in lines[1:]:
        if not line.strip():
            continue
        parts = line.split(",")
        if len(parts) < 3:
            continue
        ing_name  = parts[0].strip()
        try:
            ilosc = float(parts[1].strip())
        except ValueError:
            ilosc = 1.0
        jednostka = parts[2].strip()

        product, score = find_best_product(ing_name, products)
        weight = convert_weight(ilosc, jednostka, product) if product else max(ilosc, 1.0)

        if product and score >= MIN_MATCH_SCORE:
            print(f"  ✓ {ing_name[:30]:30s} → {product['name'][:25]:25s} (score={score:.2f}, {weight}g)")
            matched_ings.append({"product_id": product["id"], "weight": weight})
        else:
            best_name = product["name"] if product else "—"
            print(f"  ~ {ing_name[:30]:30s} → placeholder (najlepszy: {best_name[:20]}, score={score:.2f})")
            unmatched.append({"name": ing_name, "weight": weight})

    if not matched_ings and not unmatched:
        print("  Brak składników — pomijam.")
        return False

    total = len(matched_ings) + len(unmatched)
    print(f"  Dopasowano {len(matched_ings)}/{total}, placeholder: {len(unmatched)}")

    if dry_run:
        return True

    # Niedopasowane → placeholder produkty
    for item in unmatched:
        pid = get_or_create_placeholder(conn, user_id, item["name"])
        matched_ings.append({"product_id": pid, "weight": item["weight"]})

    notes = "\n".join(recipe.get("ingredients_raw", []))

    recipe_id = insert_recipe(
        conn, user_id,
        name=name,
        image_url=recipe.get("image_url", ""),
        source_url=recipe.get("url", ""),
        notes=notes,
        ingredients=matched_ings,
        kcal_100g=recipe.get("kcal_100g"),
        protein_100g=recipe.get("protein_100g"),
        fat_100g=recipe.get("fat_100g"),
        carbs_100g=recipe.get("carbs_100g"),
    )
    print(f"  Zapisano! ID={recipe_id}")
    return True


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    global MIN_MATCH_SCORE
    parser = argparse.ArgumentParser(description="Import przepisów aniagotuje.pl → baza danych")
    parser.add_argument("--dry-run",    action="store_true",
                        help="Pokaż dopasowania bez zapisywania")
    parser.add_argument("--limit",      type=int,   default=None)
    parser.add_argument("--search",     metavar="SŁOWO",
                        help="Filtruj po słowie w nazwie przepisu")
    parser.add_argument("--min-score",  type=float, default=MIN_MATCH_SCORE,
                        help=f"Próg dopasowania (domyślnie {MIN_MATCH_SCORE})")
    parser.add_argument("--user-id",    type=int,   default=DEFAULT_USER_ID)
    parser.add_argument("--list-users", action="store_true")
    args = parser.parse_args()

    MIN_MATCH_SCORE = args.min_score

    if not INPUT_FILE.exists():
        print(f"Brak pliku {INPUT_FILE}. Najpierw uruchom aniagotuje_scraper.py")
        sys.exit(1)

    conn = get_conn()

    if args.list_users:
        list_users(conn)
        conn.close()
        return

    recipes  = json.loads(INPUT_FILE.read_text("utf-8"))
    products = get_products(conn, args.user_id)

    print(f"Przepisów w pliku: {len(recipes)}")
    print(f"Produktów w bazie (user_id={args.user_id}): {len(products)}")

    if args.search:
        recipes = [r for r in recipes if args.search.lower() in r["name"].lower()]
        print(f"Po filtrowaniu '{args.search}': {len(recipes)}")

    if args.limit:
        recipes = recipes[:args.limit]

    ok = fail = 0
    for recipe in recipes:
        if process_recipe(recipe, products, conn, args.user_id, args.dry_run):
            ok += 1
        else:
            fail += 1

    conn.close()
    print(f"\n{'='*50}")
    print(f"{'DRY RUN — ' if args.dry_run else ''}Zaimportowano: {ok}, pominięte/błędy: {fail}")
    if args.dry_run:
        print("Aby naprawdę zapisać, uruchom bez --dry-run")


if __name__ == "__main__":
    main()
