#!/usr/bin/env python3
"""
debug_pipeline.py — inspekcja każdego kroku pipeline'u

Użycie:
    python debug_pipeline.py           # sprawdź wszystkie kroki
    python debug_pipeline.py --step 3  # tylko krok 3 (match_ingredients)
    python debug_pipeline.py --step 3 --ingredient "chicken breast"
    python debug_pipeline.py --step 6 --name "chicken"  # szukaj produktu w seed
    python debug_pipeline.py --db --name "chicken"       # szukaj w bazie danych

Każdy krok wypisuje:
  - ile rekordów ma plik wejściowy i wyjściowy
  - przykładowe rekordy (pierwsze 5)
  - potencjalne problemy (brakujące ceny, złe nazwy itp.)
"""

import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
from data_paths import (  # noqa: E402
    ALI_NORMALIZED,
    ALI_PRODUCTS,
    AUCHAN_PRODUCTS,
    BIEDRONKA_PRODUCTS,
    INGREDIENT_DB_EN,
    INGREDIENT_DB_PL,
    INGREDIENTS_MACROS,
    MATCHES_EN,
    MATCHES_PL,
    RECIPES_EN,
    RECIPES_NORMALIZED,
    RECIPES_PL,
    SHOPS_EN,
    SHOPS_PL,
    UNMATCHED_EN_RAW,
    UNMATCHED_PL_RAW,
    USER_SEEDS_DIR,
)

PIPELINE_FILES = {
    "aldi_products.json": ALI_PRODUCTS,
    "auchan_products.json": AUCHAN_PRODUCTS,
    "biedronka_products.json": BIEDRONKA_PRODUCTS,
    "recipes_normalized.json": RECIPES_NORMALIZED,
    "aldi_normalized.json": ALI_NORMALIZED,
    "shops_en.json": SHOPS_EN,
    "shops_pl.json": SHOPS_PL,
    "matches_en.json": MATCHES_EN,
    "matches_pl.json": MATCHES_PL,
    "unmatched_en.json": UNMATCHED_EN_RAW,
    "unmatched_pl.json": UNMATCHED_PL_RAW,
    "unmatched_en_raw.json": UNMATCHED_EN_RAW,
    "unmatched_pl_raw.json": UNMATCHED_PL_RAW,
    "ingredient_db_en.json": INGREDIENT_DB_EN,
    "ingredient_db_pl.json": INGREDIENT_DB_PL,
    "recipes_en.json": RECIPES_EN,
    "recipes_pl.json": RECIPES_PL,
    "ingredients_macros.json": INGREDIENTS_MACROS,
}


def pipeline_path(fname: str) -> Path:
    return PIPELINE_FILES[fname]


APP_DATA = USER_SEEDS_DIR


# ── Helpers ───────────────────────────────────────────────────────────────────

def load(path: Path) -> list | dict | None:
    if not path.exists():
        print(f"  [BRAK] {path.name}")
        return None
    try:
        return json.loads(path.read_text("utf-8"))
    except Exception as e:
        print(f"  [BŁĄD JSON] {path.name}: {e}")
        return None


def section(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def show_sample(items: list, n: int = 5, keys: list = None):
    """Wypisuje n pierwszych rekordów, opcjonalnie tylko wybrane klucze."""
    for item in items[:n]:
        if keys:
            row = {k: item.get(k) for k in keys if k in item}
        else:
            row = item
        print(f"  {json.dumps(row, ensure_ascii=False)}")


def find_by_name(items: list, name: str, name_keys: list) -> list:
    """Szuka rekordów zawierających `name` w którymkolwiek z name_keys."""
    name = name.lower()
    results = []
    for item in items:
        for k in name_keys:
            val = str(item.get(k, "")).lower()
            if name in val:
                results.append(item)
                break
    return results


# ── Krok 0: Surowe dane ze scraperów ─────────────────────────────────────────

def debug_step0(name_filter: str = None):
    section("KROK 0 — Surowe dane ze scraperów (data/*_products.json)")
    print("""
  Co to jest:
    Playwright odwiedza strony Aldi / Auchan / Biedronka i zapisuje produkty
    jako surowe listy JSON. Każdy produkt ma nazwę, cenę, gramaturę.

  Pliki wejściowe: (brak — scraper generuje te pliki)
  Pliki wyjściowe: data/aldi_products.json
                   data/auchan_products.json
                   data/biedronka_products.json
""")
    for fname in ("aldi_products.json", "auchan_products.json", "biedronka_products.json"):
        data = load(pipeline_path(fname))
        if data is None:
            continue
        print(f"  {fname}: {len(data)} produktów")
        if name_filter:
            found = find_by_name(data, name_filter, ["name", "title"])
            print(f"    Szukam '{name_filter}': {len(found)} wyników")
            show_sample(found, 3)
        else:
            show_sample(data, 3, ["name", "price", "weight"])


# ── Krok 1: normalize_recipes ─────────────────────────────────────────────────

def debug_step1(name_filter: str = None):
    section("KROK 1 — normalize_recipes (DeepSeek normalizuje przepisy)")
    print("""
  Co to jest:
    DeepSeek (AI) bierze surowe przepisy i:
      - tłumaczy składniki PL ↔ EN
      - normalizuje jednostki (łyżka → g, szklanka → ml)
      - wyciąga ilości jako liczby

  Plik wejściowy:  (przepisy z zewnętrznego źródła)
  Plik wyjściowy:  data/recipes_normalized.json
""")
    data = load(pipeline_path("recipes_normalized.json"))
    if data is None:
        return
    print(f"  Liczba przepisów: {len(data)}")

    if name_filter:
        found = [r for r in data if name_filter.lower() in r.get("name_en","").lower()
                                 or name_filter.lower() in r.get("name_pl","").lower()]
        print(f"  Szukam '{name_filter}': {len(found)} przepisów")
        for r in found[:2]:
            print(f"\n  Przepis: {r.get('name_en')} / {r.get('name_pl')}")
            print(f"  Składniki EN:")
            for ing in r.get("ingredients_en", [])[:5]:
                print(f"    {ing}")
            print(f"  Składniki PL:")
            for ing in r.get("ingredients_pl", [])[:5]:
                print(f"    {ing}")
    else:
        print("\n  Przykłady (pierwsze 3 przepisy):")
        for r in data[:3]:
            ings_en = r.get("ingredients_en", [])
            print(f"  [{r.get('name_en')}] — {len(ings_en)} składników EN: "
                  f"{[i['name'] for i in ings_en[:3]]}")

    # Problemy
    no_ings = [r for r in data if not r.get("ingredients_en")]
    if no_ings:
        print(f"\n  [UWAGA] {len(no_ings)} przepisów bez składników EN:")
        for r in no_ings[:5]:
            print(f"    - {r.get('name_en')}")


# ── Krok 2: normalize_shops ───────────────────────────────────────────────────

def debug_step2(name_filter: str = None):
    section("KROK 2 — normalize_shops (czyszczenie produktów sklepowych)")
    print("""
  Co to jest:
    Czysty Python (bez AI) przetwarza surowe dane ze scraperów:
      - filtruje gotowe dania (pizza, kanapki, ciasta itp.)
      - wyciąga gramaturę z nazwy produktu (np. "Chicken 500g" → 500g)
      - tworzy generic_name (uproszczona nazwa sklepowa)
      - deduplikuje (zostaje najtańszy per generic_name)

    UWAGA: generic_name dla EN (Aldi) pochodzi z nazwy sklepowej,
    dlatego może być śmieciowy ("sausage rolls 6 pack", "cheese select").
    To właśnie match_ingredients używa ingredient_name z przepisów.

  Pliki wejściowe:  data/aldi_products.json + auchan + biedronka
  Pliki wyjściowe:  data/shops_en.json (Aldi, po angielsku)
                    data/shops_pl.json (Auchan + Biedronka, po polsku)
                    data/aldi_normalized.json (tylko Aldi, surowo)
""")
    for lang, fname in (("EN", "shops_en.json"), ("PL", "shops_pl.json")):
        data = load(pipeline_path(fname))
        if data is None:
            continue
        print(f"\n  {fname}: {len(data)} produktów ({lang})")
        no_price = [x for x in data if not x.get("price_per_100")]
        print(f"    Bez ceny: {len(no_price)} / {len(data)}")

        if name_filter:
            found = find_by_name(data, name_filter,
                                 ["original_name", "generic_name", "name"])
            print(f"    Szukam '{name_filter}': {len(found)} wyników")
            show_sample(found, 5, ["original_name", "generic_name", "price_per_100", "unit"])
        else:
            show_sample(data, 3, ["original_name", "generic_name", "price_per_100"])

    # Aldi normalized
    aldi = load(pipeline_path("aldi_normalized.json"))
    if aldi:
        print(f"\n  aldi_normalized.json: {len(aldi)} produktów")
        filtered_out = [x for x in aldi if x.get("filtered_reason")]
        if filtered_out:
            print(f"    Przefiltrowane (gotowe dania): {len(filtered_out)}")
            show_sample(filtered_out[:3], 3, ["original_name", "filtered_reason"])


# ── Krok 3: match_ingredients ─────────────────────────────────────────────────

def debug_step3(name_filter: str = None):
    section("KROK 3 — match_ingredients (dopasowanie składników do sklepu)")
    print("""
  Co to jest:
    Każdy składnik z przepisów musi zostać dopasowany do produktu sklepowego.
    Algorytm:
      1. Canonicalizacja: "chicken" → "chicken breast" (słownik aliasów)
      2. rapidfuzz: porównuje string-y → wynik 0-100
         - >= 85: MATCH_AUTO (pewne dopasowanie, bez AI)
         - 55-84: UNCERTAIN (DeepSeek decyduje tak/nie)
         - < 55:  NO_MATCH (ignorowane)
      3. DeepSeek dla UNCERTAIN: batch po 15 składników

    Wynik: lista matches (ingredient_name → original_name sklepowy + cena)

  Pliki wejściowe:  data/recipes_normalized.json, data/shops_en.json, data/shops_pl.json
  Pliki wyjściowe:  data/matches_en.json
                    data/matches_pl.json
                    data/unmatched_en.json  (składniki bez dopasowania)
                    data/unmatched_pl.json
""")
    for lang, mfile, ufile in (
        ("EN", "matches_en.json",   "unmatched_en.json"),
        ("PL", "matches_pl.json",   "unmatched_pl.json"),
    ):
        matches   = load(pipeline_path(mfile))
        unmatched = load(pipeline_path(ufile))
        if matches is None:
            continue

        # unmatched może być listą lub dict
        if isinstance(unmatched, dict):
            u_count = sum(len(v) for v in unmatched.values())
        elif isinstance(unmatched, list):
            u_count = len(unmatched)
        else:
            u_count = 0

        print(f"\n  {mfile}: {len(matches)} dopasowań")
        print(f"  {ufile}: {u_count} niedopasowanych składników")

        auto   = [m for m in matches if m.get("match_type") == "auto"]
        ai     = [m for m in matches if m.get("match_type") == "ai"]
        no_pr  = [m for m in matches if not m.get("price_per_100")]
        print(f"    auto (rapidfuzz): {len(auto)}, AI (DeepSeek): {len(ai)}, "
              f"bez ceny: {len(no_pr)}")

        if name_filter:
            found = find_by_name(matches, name_filter,
                                 ["ingredient_name", "original_name", "generic_name"])
            print(f"    Szukam '{name_filter}': {len(found)} wyników")
            show_sample(found, 5, ["ingredient_name", "original_name",
                                   "match_type", "fuzzy_score", "price_per_100"])
        else:
            print(f"    Przykłady (auto):")
            show_sample(auto[:3], 3, ["ingredient_name", "original_name", "fuzzy_score"])
            if ai:
                print(f"    Przykłady (AI):")
                show_sample(ai[:3], 3, ["ingredient_name", "original_name", "fuzzy_score"])

        # Podejrzane dopasowania
        low_score = [m for m in matches if m.get("fuzzy_score", 100) < 70]
        if low_score:
            print(f"\n    [UWAGA] {len(low_score)} dopasowań z niskim fuzzy_score (<70):")
            show_sample(low_score[:5], 5,
                        ["ingredient_name", "original_name", "fuzzy_score", "match_type"])


# ── Krok 4: build_database ────────────────────────────────────────────────────

def debug_step4(name_filter: str = None):
    section("KROK 4 — build_database (budowa ingredient_db + recipes z kosztem)")
    print("""
  Co to jest:
    Łączy matches z kroków 3 z cenami i buduje finalne bazy:
      - ingredient_db_en/pl.json: pełna lista składników z cenami
        (ingredient_name, generic_name, original_name, price_per_100, unit...)
      - recipes_en/pl.json: przepisy z estimated_cost (sumuje ceny składników)
      - unmatched_en/pl_raw.json: składniki całkowicie bez dopasowania

    ingredient_name = czysta nazwa z przepisu ("chicken breast")
    generic_name    = uproszczona nazwa sklepowa ("chicken breast fillets")
    original_name   = oryginalna nazwa Aldi ("British Chicken Breast Fillets")

  Pliki wejściowe:  data/matches_en.json, data/recipes_normalized.json
  Pliki wyjściowe:  data/ingredient_db_en.json
                    data/ingredient_db_pl.json
                    data/recipes_en.json
                    data/recipes_pl.json
""")
    for lang, dbfile, rfile in (
        ("EN", "ingredient_db_en.json", "recipes_en.json"),
        ("PL", "ingredient_db_pl.json", "recipes_pl.json"),
    ):
        db   = load(pipeline_path(dbfile))
        recs = load(pipeline_path(rfile))
        if db is None:
            continue

        no_price = [x for x in db if not x.get("price_per_100")]
        print(f"\n  {dbfile}: {len(db)} składników, bez ceny: {len(no_price)}")
        if recs:
            no_cost = [r for r in recs if not r.get("estimated_cost_gbp")]
            print(f"  {rfile}: {len(recs)} przepisów, bez kosztu: {len(no_cost)}")

        if name_filter:
            found = find_by_name(db, name_filter,
                                 ["ingredient_name", "generic_name", "original_name"])
            print(f"  Szukam '{name_filter}' w {dbfile}: {len(found)} wyników")
            show_sample(found, 5, ["ingredient_name", "generic_name",
                                   "original_name", "price_per_100", "unit"])
        else:
            print(f"  Przykłady z {dbfile}:")
            show_sample(db[:4], 4, ["ingredient_name", "original_name",
                                    "price_per_100", "unit"])

        # Podejrzane generic_name (zawierają "pack", "select", "rolls" itp.)
        garbage_keywords = ["pack", "select", "rolls", "grinder", "loaf",
                            "selection", "slices 2", "and cheese"]
        garbage = [x for x in db if any(
            kw in (x.get("generic_name") or "").lower() for kw in garbage_keywords
        )]
        if garbage:
            print(f"\n  [UWAGA] {len(garbage)} wpisów z podejrzanym generic_name:")
            show_sample(garbage[:5], 5, ["ingredient_name", "generic_name", "original_name"])


# ── Krok 5: get_macros ────────────────────────────────────────────────────────

def debug_step5(name_filter: str = None):
    section("KROK 5 — get_macros (makroskładniki przez DeepSeek)")
    print("""
  Co to jest:
    DeepSeek pobiera makroskładniki (kcal, białko, tłuszcz, węglowodany)
    dla każdego unikalnego składnika. Dane te są używane w kalkulatorze
    i kartach przepisów.

  Plik wejściowy:  data/ingredient_db_en.json (lista składników)
  Plik wyjściowy:  data/ingredients_macros.json
""")
    data = load(pipeline_path("ingredients_macros.json"))
    if data is None:
        return
    print(f"  Liczba składników z makro: {len(data)}")

    no_kcal = [x for x in data if not x.get("kcal")]
    print(f"  Bez kcal: {len(no_kcal)}")

    if name_filter:
        found = find_by_name(data, name_filter, ["name_en", "name_pl"])
        print(f"  Szukam '{name_filter}': {len(found)} wyników")
        show_sample(found, 5)
    else:
        print(f"  Przykłady:")
        show_sample(data[:5], 5, ["name_en", "kcal", "protein_g", "fat_g", "carbs_g"])


# ── Krok 6: dump_seeds ────────────────────────────────────────────────────────

def debug_step6(name_filter: str = None):
    section("KROK 6 — dump_seeds (generowanie plików seed dla nowych użytkowników)")
    print("""
  Co to jest:
    Generuje pliki JSON które są wczytywane gdy nowy użytkownik się rejestruje.
    Używa ingredient_name (NIE generic_name) jako nazwy produktu.
    Zawiera ceny (price_per_100), gramaturę i makroskładniki.

  Plik wejściowy:  data/ingredient_db_en.json, data/ingredients_macros.json,
                   data/recipes_en.json
  Plik wyjściowy:  app/data/products_seed_en.json
                   app/data/recipes_seed_en.json
""")
    prods = load(USER_SEEDS_DIR /  "products_seed_en.json")
    recs  = load(USER_SEEDS_DIR /  "recipes_seed_en.json")

    if prods:
        no_price = [p for p in prods if not p.get("price")]
        with_price = [p for p in prods if p.get("price")]
        print(f"  products_seed_en.json: {len(prods)} produktów")
        print(f"    Z ceną: {len(with_price)}, bez ceny: {len(no_price)}")

        if name_filter:
            found = find_by_name(prods, name_filter, ["name"])
            print(f"  Szukam '{name_filter}': {len(found)} wyników")
            show_sample(found, 5, ["name", "price", "unit", "kcal"])
        else:
            print(f"  Przykłady z ceną:")
            with_price_sorted = sorted(with_price, key=lambda x: x["price"], reverse=True)
            show_sample(with_price_sorted[:3], 3, ["name", "price", "unit"])
            print(f"  Przykłady BEZ ceny:")
            show_sample(no_price[:3], 3, ["name", "price", "unit"])

    if recs:
        print(f"\n  recipes_seed_en.json: {len(recs)} przepisów")
        if name_filter:
            found = find_by_name(recs, name_filter, ["name"])
            print(f"  Szukam '{name_filter}': {len(found)} wyników")
            for r in found[:2]:
                print(f"    [{r['name']}] {len(r.get('ingredients',[]))} składników: "
                      f"{[i['product_name'] for i in r.get('ingredients',[])[:4]]}")
        else:
            print(f"  Przykłady:")
            for r in recs[:3]:
                print(f"    [{r['name']}] {len(r.get('ingredients',[]))} składników")


# ── Krok 7: Baza danych (PostgreSQL przez Flask) ──────────────────────────────

def debug_db(name_filter: str = None):
    section("KROK 7 — Baza danych PostgreSQL (via Flask/SQLAlchemy)")
    print("""
  Co to jest:
    Dane z seed (lub import_to_db.py) trafiają do tabeli `products` i `recipes`
    w PostgreSQL. Każdy użytkownik ma własne wiersze z user_id.

    seed_user()       — wywoływana przy rejestracji, wczytuje pliki seed
    import_to_db.py   — ręczny reimport przez CLI (--user-id, --clear, --lang)

  Jak sprawdzić przez psql:
    docker exec mealprep-db-1 psql -U user -d mealplanner -c "\\dt"
    docker exec mealprep-db-1 psql -U user -d mealplanner -c "SELECT COUNT(*) FROM products;"
""")
    # Próba połączenia przez SQLAlchemy (jeśli uruchamiamy z kontenera)
    try:
        import os, sys
        sys.path.insert(0, str(HERE.parent))
        os.environ.setdefault("DATABASE_URL", "postgresql://user:password@localhost:5432/mealplanner")

        from app import create_app, db
        from app.models.product import Product
        from app.models.recipe import Recipe
        from app.models.user import User

        app = create_app()
        with app.app_context():
            users = User.query.all()
            print(f"\n  Użytkownicy w bazie: {len(users)}")
            for u in users:
                prods = Product.query.filter_by(user_id=u.id).count()
                recs  = Recipe.query.filter_by(user_id=u.id).count()
                print(f"    id={u.id}  {u.email:<35}  {prods} produktów, {recs} przepisów  lang={u.lang}")

            if name_filter:
                found = Product.query.filter(
                    Product.name.ilike(f"%{name_filter}%")
                ).order_by(Product.user_id, Product.name).all()
                print(f"\n  Szukam produktu '{name_filter}': {len(found)} wyników")
                for p in found[:10]:
                    print(f"    user_id={p.user_id}  lang={p.lang}  "
                          f"name={p.name!r}  price={p.price}  unit={p.unit}")

    except Exception as e:
        print(f"\n  [Niedostępne z zewnątrz Dockera] Błąd: {e}")
        print("""
  Uruchom wewnątrz kontenera:
    docker exec -it mealprep-app-1 python /app/scraper/debug_pipeline.py --step 7
  Lub przez psql:
    docker exec mealprep-db-1 psql -U user -d mealplanner \\
      -c "SELECT name, price FROM products WHERE user_id=2 AND lang='en' LIMIT 10;"
""")


# ── Krok 8: API Flask ─────────────────────────────────────────────────────────

def debug_api():
    section("KROK 8 — API Flask (GET /api/products/)")
    print("""
  Co to jest:
    Frontend wysyła żądanie HTTP do backendu Flask.
    Flask sprawdza JWT token, wyciąga user_id, zwraca produkty z bazy.

  Endpoint:  GET http://localhost:5001/api/products/
  Nagłówek:  Authorization: Bearer <JWT_TOKEN>

  Jak przetestować (curl):
    # 1. Zaloguj się przez Google w przeglądarce (http://localhost:3000),
    #    potem skopiuj token z DevTools → Application → Local Storage → token

    TOKEN="<JWT_TOKEN_Z_LOCALSTORAGE>"

    # 2. Pobierz produkty:
    curl -H "Authorization: Bearer $TOKEN" http://localhost:5001/api/products/

    # 3. Policz produkty:
    curl -s -H "Authorization: Bearer $TOKEN" http://localhost:5001/api/products/ \\
      | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d), 'produktów')"

  Plik backendu:  app/routes/products.py
  Kluczowa linia: Product.query.filter_by(user_id=uid).order_by(Product.name).all()
""")


# ── Krok 9: Frontend React ────────────────────────────────────────────────────

def debug_frontend():
    section("KROK 9 — Frontend React (Products.js)")
    print("""
  Co to jest:
    React pobiera dane z API przez axios i wyświetla listę produktów.

  Plik:      frontend/src/components/Products.js
  API call:  api.get('/products/')  →  axios z JWT w nagłówku

  Jak działają ceny w UI:
    if (!p.price) return '-';          // cena=0 → myślnik
    price_per_100 * package_weight / 100 = cena za opakowanie

  Jak działa wyszukiwanie:
    fuzzySearch(query, p.name)         // Levenshtein distance, próg ceil(len/4)
    Plik: frontend/src/utils/search.js

  Filtrowanie po języku:
    Produkty mają pole lang ('en'/'pl').
    Backend filtruje już po user_id — lang nie jest kluczem filtru w API,
    ale jest przechowywany dla przyszłych zastosowań.
""")


# ── Sprawdzenie wszystkich plików pośrednich ──────────────────────────────────

def debug_files_summary():
    section("PODSUMOWANIE — stan wszystkich plików pipeline'u")
    files = [
        # (krok, opis, ścieżka)
        (0, "aldi_products.json",        pipeline_path("aldi_products.json")),
        (0, "auchan_products.json",       pipeline_path("auchan_products.json")),
        (0, "biedronka_products.json",    pipeline_path("biedronka_products.json")),
        (1, "recipes_normalized.json",    pipeline_path("recipes_normalized.json")),
        (2, "aldi_normalized.json",       pipeline_path("aldi_normalized.json")),
        (2, "shops_en.json",              pipeline_path("shops_en.json")),
        (2, "shops_pl.json",              pipeline_path("shops_pl.json")),
        (3, "matches_en.json",            pipeline_path("matches_en.json")),
        (3, "matches_pl.json",            pipeline_path("matches_pl.json")),
        (3, "unmatched_en.json",          pipeline_path("unmatched_en.json")),
        (3, "unmatched_pl.json",          pipeline_path("unmatched_pl.json")),
        (4, "ingredient_db_en.json",      pipeline_path("ingredient_db_en.json")),
        (4, "ingredient_db_pl.json",      pipeline_path("ingredient_db_pl.json")),
        (4, "recipes_en.json",            pipeline_path("recipes_en.json")),
        (4, "recipes_pl.json",            pipeline_path("recipes_pl.json")),
        (5, "ingredients_macros.json",    pipeline_path("ingredients_macros.json")),
        (6, "products_seed_en.json",      USER_SEEDS_DIR /  "products_seed_en.json"),
        (6, "recipes_seed_en.json",       USER_SEEDS_DIR /  "recipes_seed_en.json"),
    ]
    print(f"\n  {'Krok':<5} {'Plik':<35} {'Rekordów':>10}  Status")
    print(f"  {'-'*65}")
    for step, name, path in files:
        if path.exists():
            try:
                data = json.loads(path.read_text("utf-8"))
                count = len(data) if isinstance(data, list) else "dict"
                print(f"  [{step}]   {name:<35} {str(count):>10}  OK")
            except Exception:
                print(f"  [{step}]   {name:<35} {'?':>10}  BŁĄD JSON")
        else:
            print(f"  [{step}]   {name:<35} {'—':>10}  BRAK")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(
        description="Debugger pipeline'u OnTrack (scraper → DB → UI)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Przykłady:
  python debug_pipeline.py                        # podsumowanie + wszystkie kroki
  python debug_pipeline.py --step 3               # tylko match_ingredients
  python debug_pipeline.py --step 3 --name sausage
  python debug_pipeline.py --step 4 --name chicken
  python debug_pipeline.py --db --name beef       # szukaj w bazie
  python debug_pipeline.py --step 6 --name rice   # szukaj w seed
        """
    )
    ap.add_argument("--step", type=int, choices=range(10),
                    help="Krok do sprawdzenia (0-9, 0=scraper, 7=DB, 8=API, 9=frontend)")
    ap.add_argument("--name", "--ingredient", dest="name",
                    help="Filtruj po nazwie składnika/produktu")
    ap.add_argument("--db", action="store_true",
                    help="Sprawdź bazę danych (wymaga uruchomienia w kontenerze)")
    args = ap.parse_args()

    if args.db:
        debug_db(args.name)
        return

    if args.step is None:
        # Pokaż wszystko
        debug_files_summary()
        debug_step0(args.name)
        debug_step1(args.name)
        debug_step2(args.name)
        debug_step3(args.name)
        debug_step4(args.name)
        debug_step5(args.name)
        debug_step6(args.name)
        debug_api()
        debug_frontend()
    else:
        dispatch = {
            0: debug_step0,
            1: debug_step1,
            2: debug_step2,
            3: debug_step3,
            4: debug_step4,
            5: debug_step5,
            6: debug_step6,
            7: debug_db,
            8: lambda _=None: debug_api(),
            9: lambda _=None: debug_frontend(),
        }
        dispatch[args.step](args.name)


if __name__ == "__main__":
    main()
