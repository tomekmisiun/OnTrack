"""
Konwersja i seed produktów z auchan_products.json / biedronka_products.json
do tabeli products w bazie danych.

Użycie:
    # Podgląd — pokaż co zostałoby dodane bez zapisywania:
    python seed_products.py --dry-run

    # Importuj do bazy (domyślnie tylko dla DEFAULT_USER_ID):
    python seed_products.py

    # Importuj dla wszystkich użytkowników w bazie:
    python seed_products.py --all-users

    # Pokaż listę użytkowników:
    python seed_products.py --list-users

    # Pokaż zduplikowane nazwy (po normalizacji):
    python seed_products.py --show-dupes
"""

import re
import sys
import json
import argparse
from pathlib import Path

import psycopg2

AUCHAN_FILE    = Path(__file__).parent / "auchan_products.json"
BIEDRONKA_FILE = Path(__file__).parent / "biedronka_products.json"

DB_CONFIG = {
    "host":     "localhost",
    "port":     5432,
    "dbname":   "mealplanner",
    "user":     "user",
    "password": "password",
}

DEFAULT_USER_ID = 2   # sprawdź: python seed_products.py --list-users


# ── Czyszczenie nazw ──────────────────────────────────────────────────────────

# Słowa/frazy do usunięcia (bez względu na pozycję)
REMOVE_PHRASES = [
    "Pewni Dobrego", "Auchan", "Biedronka",
    "Warzywa Auchan", "Owoce Auchan", "Mięso Auchan",
    "na wagę", "ok\\.", "opakowanie", "tacka",
]

# Słowa samodzielne do usunięcia TYLKO gdy stoją na końcu nazwy (etykiety kategorii Auchan)
REMOVE_WORDS_SUFFIX = {"warzywa", "owoce", "nabiał", "piekarnia", "sztuka"}

# Wzorce wag/objętości/ilości na końcu nazwy (lub w środku)
WEIGHT_PAT = re.compile(
    r"\s+\d+(?:[.,]\d+)?\s*(?:kg|dag|g|litr(?:y|ów)?|l|ml|szt(?:uk[ai]?)?)\b\.?",
    re.IGNORECASE
)


def clean_name(raw: str) -> str:
    name = raw.strip()

    # Usuń frazy specyficzne dla sklepów
    for phrase in REMOVE_PHRASES:
        name = re.sub(rf"\s*{phrase}\s*", " ", name, flags=re.IGNORECASE)

    # Usuń wzorce wag/ilości (np. "125 g", "2 kg", "10 szt")
    name = WEIGHT_PAT.sub(" ", name)

    # Usuń słowa-etykiety kategorii gdy stoją na końcu nazwy
    words = name.split()
    while words and words[-1].lower() in REMOVE_WORDS_SUFFIX:
        words.pop()
    name = " ".join(words)

    # Usuń wielokrotne spacje i zbędne znaki na końcach
    name = re.sub(r"\s{2,}", " ", name).strip(" -–,.")

    # Pierwsza litera zawsze wielka
    if name:
        name = name[0].upper() + name[1:]
    return name


# ── Parsowanie package_size ───────────────────────────────────────────────────

def parse_package_size(size_str: str) -> tuple[float, str]:
    """
    Zwraca (package_weight, unit).
    unit ∈ {'g', 'ml', 'szt'}
    """
    s = size_str.strip().lower().rstrip(".")

    if s in ("na wagę", ""):
        return 100.0, "g"   # domyślna waga dla produktów na wagę

    # "125g", "500ml", "1000g", "2000ml"
    m = re.match(r"^(\d+(?:[.,]\d+)?)\s*(g|ml)$", s)
    if m:
        return float(m.group(1).replace(",", ".")), m.group(2)

    # "10szt", "10szt."
    m = re.match(r"^(\d+(?:[.,]\d+)?)\s*szt\.?$", s)
    if m:
        return float(m.group(1).replace(",", ".")), "szt"

    # "1szt" jako 1 sztuka
    m = re.match(r"^1\s*szt\.?$", s)
    if m:
        return 1.0, "szt"

    # "0szt" (błąd w danych) — 1 szt
    if re.match(r"^0\s*szt\.?$", s):
        return 1.0, "szt"

    # Fallback — zwróć 100g
    return 100.0, "g"


# ── Parsowanie ceny na jednostkę ──────────────────────────────────────────────

def parse_price_per_unit(price_per_unit_str: str, package_price: float,
                         package_weight: float, unit: str) -> float:
    """
    Przelicza cenę do formatu bazy danych:
      - dla g/ml: cena za 100g lub 100ml
      - dla szt:  cena za 1 szt

    price_per_unit_str przykłady:
      "27.60 zł/kg", "26.90 zł/100gram", "1.72 zł/szt",
      "3.45 zł/litre", "3.45 zł/l", "26.90 zł/100ml"
    """
    s = (price_per_unit_str or "").lower().strip()
    m = re.match(r"([\d.,]+)\s*zł/(.+)", s)
    if not m:
        # Fallback: oblicz z ceny opakowania
        if unit == "szt":
            return round(package_price / max(package_weight, 1), 4)
        return round(package_price / max(package_weight, 1) * 100, 4)

    value = float(m.group(1).replace(",", "."))
    per   = m.group(2).strip().rstrip(".")

    if per in ("kg",):
        return round(value / 10, 4)            # /kg → /100g
    if per in ("litre", "litr", "l"):
        return round(value / 10, 4)            # /litr → /100ml
    if per in ("100gram", "100g", "100 gram"):
        return round(value, 4)                 # już /100g
    if per in ("100ml", "100 ml"):
        return round(value, 4)                 # już /100ml
    if per in ("szt", "szt.", "sztuka"):
        return round(value, 4)                 # /szt
    # Nieznana — oblicz z ceny opakowania
    if unit == "szt":
        return round(package_price / max(package_weight, 1), 4)
    return round(package_price / max(package_weight, 1) * 100, 4)


# ── Ekstrakcja wagi "na wagę" z nazwy produktu ───────────────────────────────

def extract_weight_from_name(name: str) -> float | None:
    """Szuka wzorca 'ok. 300 g' lub '500 g' w nazwie, zwraca gramy."""
    m = re.search(r"(?:ok\.?\s*)?(\d+(?:[.,]\d+)?)\s*(?:g|kg)\b", name, re.IGNORECASE)
    if m:
        val = float(m.group(1).replace(",", "."))
        if "kg" in m.group(0).lower():
            val *= 1000
        return val
    return None


# ── Normalizacja do deduplikacji ──────────────────────────────────────────────

def normalize_key(name: str, unit: str) -> str:
    """Klucz do deduplikacji: małe litery, bez polskich znaków, bez spacji."""
    t = name.lower()
    for a, b in [("ą","a"),("ć","c"),("ę","e"),("ł","l"),
                 ("ń","n"),("ó","o"),("ś","s"),("ź","z"),("ż","z")]:
        t = t.replace(a, b)
    t = re.sub(r"[^a-z0-9]", "", t)
    return f"{t}_{unit}"


# ── Konwersja jednego rekordu ─────────────────────────────────────────────────

def convert(raw: dict, source: str) -> dict | None:
    """
    Zwraca słownik gotowy do wstawienia do bazy lub None jeśli rekord jest błędny.

    Pola wyjściowe:
      name, package_weight, price, unit, sold_by_weight, source
    """
    raw_name    = raw.get("name", "").strip()
    size_str    = raw.get("package_size", "")
    pkg_price   = raw.get("price") or 0.0
    ppu_str     = raw.get("price_per_unit", "")
    sold_by_wt  = bool(raw.get("sold_by_weight", False))

    if not raw_name or pkg_price <= 0:
        return None

    # Parsuj package_size
    if sold_by_wt or size_str.strip().lower() == "na wagę":
        sold_by_wt    = True
        # Spróbuj wyciągnąć wagę z nazwy, np. "ok. 300 g"
        extracted_wt  = extract_weight_from_name(raw_name)
        package_weight = extracted_wt if extracted_wt else 100.0
        unit           = "g"
    else:
        package_weight, unit = parse_package_size(size_str)

    # Cena w formacie bazy
    price = parse_price_per_unit(ppu_str, pkg_price, package_weight, unit)
    if price <= 0:
        return None

    # Wyczyść nazwę
    name = clean_name(raw_name)
    if not name or len(name) < 2:
        return None

    return {
        "name":           name,
        "package_weight": package_weight,
        "price":          price,
        "unit":           unit,
        "sold_by_weight": sold_by_wt,
        "source":         source,
    }


# ── Ładowanie i deduplikacja ──────────────────────────────────────────────────

def load_all() -> list[dict]:
    records = []
    for fpath, source in [(AUCHAN_FILE, "auchan"), (BIEDRONKA_FILE, "biedronka")]:
        if not fpath.exists():
            print(f"Brak pliku {fpath.name} — pomijam.", file=sys.stderr)
            continue
        raw_list = json.loads(fpath.read_text("utf-8"))
        print(f"Wczytano {len(raw_list):4d} rekordów z {fpath.name}")
        for raw in raw_list:
            converted = convert(raw, source)
            if converted:
                records.append(converted)

    print(f"Po konwersji: {len(records)} poprawnych rekordów")

    # Deduplikacja po nazwie + jednostce (zachowaj pierwszą wersję)
    seen: dict[str, dict] = {}
    dupes = 0
    for r in records:
        key = normalize_key(r["name"], r["unit"])
        if key not in seen:
            seen[key] = r
        else:
            dupes += 1

    unique = list(seen.values())
    print(f"Po deduplikacji: {len(unique)} unikalnych (odrzucono {dupes} duplikatów)")
    return unique


# ── Baza danych ───────────────────────────────────────────────────────────────

def get_conn():
    return psycopg2.connect(**DB_CONFIG)


def list_users(conn) -> None:
    with conn.cursor() as cur:
        cur.execute("SELECT id, email FROM users ORDER BY id")
        rows = cur.fetchall()
    print("Użytkownicy w bazie:")
    for uid, email in rows:
        marker = " ← DEFAULT_USER_ID" if uid == DEFAULT_USER_ID else ""
        print(f"  id={uid}  {email}{marker}")


def get_existing_keys(conn, user_id: int) -> set[str]:
    with conn.cursor() as cur:
        cur.execute("SELECT name, unit FROM products WHERE user_id = %s", (user_id,))
        return {normalize_key(name, unit) for name, unit in cur.fetchall()}


def insert_products(conn, user_id: int, products: list[dict]) -> int:
    with conn.cursor() as cur:
        for p in products:
            cur.execute(
                """INSERT INTO products (user_id, name, package_weight, price, unit, sold_by_weight)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (user_id, p["name"], p["package_weight"],
                 p["price"], p["unit"], p["sold_by_weight"])
            )
    conn.commit()
    return len(products)


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Seed produktów ze sklepów do bazy Meal Planner")
    parser.add_argument("--dry-run",    action="store_true",
                        help="Pokaż co zostałoby dodane, bez zapisywania")
    parser.add_argument("--all-users",  action="store_true",
                        help="Dodaj produkty dla wszystkich użytkowników w bazie")
    parser.add_argument("--user-id",    type=int, default=DEFAULT_USER_ID,
                        help=f"ID użytkownika (domyślnie: {DEFAULT_USER_ID})")
    parser.add_argument("--list-users", action="store_true",
                        help="Pokaż listę użytkowników")
    parser.add_argument("--show-dupes", action="store_true",
                        help="Pokaż zduplikowane nazwy przed deduplikacją")
    parser.add_argument("--source",     choices=["auchan", "biedronka", "oba"],
                        default="oba", help="Źródło danych (domyślnie: oba)")
    args = parser.parse_args()

    conn = get_conn()

    if args.list_users:
        list_users(conn)
        conn.close()
        return

    print()
    products = load_all()
    print()

    if args.source != "oba":
        products = [p for p in products if p["source"] == args.source]
        print(f"Po filtrze source={args.source}: {len(products)}")

    if args.show_dupes:
        # Pokaż zduplikowane nazwy przed deduplikacją
        from collections import Counter
        raw_keys = []
        for fpath, source in [(AUCHAN_FILE, "auchan"), (BIEDRONKA_FILE, "biedronka")]:
            if fpath.exists():
                for raw in json.loads(fpath.read_text("utf-8")):
                    c = convert(raw, source)
                    if c:
                        raw_keys.append(normalize_key(c["name"], c["unit"]))
        dupes = [(k, v) for k, v in Counter(raw_keys).items() if v > 1]
        print(f"\nZduplikowane klucze ({len(dupes)}):")
        for k, v in sorted(dupes, key=lambda x: -x[1])[:30]:
            print(f"  {v}×  {k}")
        conn.close()
        return

    # Ustal listę użytkowników
    if args.all_users:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users ORDER BY id")
            user_ids = [row[0] for row in cur.fetchall()]
    else:
        user_ids = [args.user_id]

    if args.dry_run:
        print(f"[DRY RUN] Produktów do dodania (przed sprawdzeniem duplikatów w bazie): {len(products)}")
        print("\nPierwsze 30:")
        for p in products[:30]:
            price_str = f"{p['price']:.4f} zł/{'100' if p['unit'] != 'szt' else ''}{'szt' if p['unit'] == 'szt' else p['unit']}"
            wt_str    = f"{p['package_weight']}{p['unit']}"
            sbw       = " [na wagę]" if p["sold_by_weight"] else ""
            src       = f"[{p['source']}]"
            print(f"  {src:10s} {p['name'][:45]:45s} {wt_str:8s} {price_str:18s}{sbw}")
        print("\nAby naprawdę zapisać, uruchom bez --dry-run")
        conn.close()
        return

    total_added = 0
    total_skipped = 0

    for uid in user_ids:
        existing = get_existing_keys(conn, uid)
        to_insert = [p for p in products if normalize_key(p["name"], p["unit"]) not in existing]
        skipped   = len(products) - len(to_insert)

        print(f"User {uid}: {len(to_insert)} nowych, {skipped} już istniejących — ", end="", flush=True)

        if to_insert:
            insert_products(conn, uid, to_insert)
            print(f"dodano {len(to_insert)}.")
        else:
            print("nic do dodania.")

        total_added   += len(to_insert)
        total_skipped += skipped

    conn.close()
    print(f"\nGotowe! Dodano: {total_added}, pominięto (duplikaty): {total_skipped}.")


if __name__ == "__main__":
    main()
