"""
Scraper przepisów z mealpreponfleek.com

Kategorie:
  breakfast  — /meal-prep-recipes/breakfast-meal-prep/
  lunch      — /meal-prep-recipes/lunch-meal-prep/
  dinner     — /meal-prep-recipes/dinner-meal-prep/
  desserts   — /meal-prep-recipes/dessert/
  snacks     — /meal-prep-recipes/snacks/

Wyniki:
  data/mealpreponfleek_recipes.json  — pełne dane (name, url, image_url, category, ingredients)
  data/mealpreponfleek_names.txt     — same nazwy, 1 per linia (do ręcznej edycji)

Workflow filtrowania:
  1. Uruchom scraper → powstają oba pliki
  2. Edytuj mealpreponfleek_names.txt — usuń linie z niechcianymi przepisami
  3. Uruchom: python mealpreponfleek_scraper.py --filter

Użycie:
    python mealpreponfleek_scraper.py               # pobierz wszystko
    python mealpreponfleek_scraper.py --limit 20    # test na 20 przepisach
    python mealpreponfleek_scraper.py --filter       # filtruj JSON według names.txt
    python mealpreponfleek_scraper.py --list         # pokaż co jest zapisane
"""

import re
import sys
import json
import time
import random
import argparse
import urllib.request
import urllib.error
from pathlib import Path

DATA_DIR    = Path(__file__).parent.parent / "data"
OUTPUT_FILE = DATA_DIR / "mealpreponfleek_recipes.json"
NAMES_FILE  = DATA_DIR / "mealpreponfleek_names.txt"

CATEGORIES = [
    ("breakfast", "https://mealpreponfleek.com/meal-prep-recipes/breakfast-meal-prep/"),
    ("lunch",     "https://mealpreponfleek.com/meal-prep-recipes/lunch-meal-prep/"),
    ("dinner",    "https://mealpreponfleek.com/meal-prep-recipes/dinner-meal-prep/"),
    ("desserts",  "https://mealpreponfleek.com/meal-prep-recipes/dessert/"),
    ("snacks",    "https://mealpreponfleek.com/meal-prep-recipes/snacks/"),
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


# ── HTTP ──────────────────────────────────────────────────────────────────────

def fetch(url: str, retries: int = 3) -> str | None:
    req = urllib.request.Request(url, headers=HEADERS)
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                return resp.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
        except Exception:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
    return None


# ── Zbieranie kart z kategorii ────────────────────────────────────────────────

def scrape_category_page(html: str) -> list[dict]:
    """
    Wyciąga kafelki przepisów z jednej strony kategorii.
    Każdy kafelek to <li class="listing-item"> z URL, img i nazwą.
    Zwraca listę {url, image_url, name}.
    """
    cards = []
    items = re.findall(
        r'<li[^>]*class="listing-item"[^>]*>.*?</li>',
        html, re.DOTALL
    )
    for item in items:
        url_m = re.search(r'<a[^>]+href="(https://mealpreponfleek\.com/[^"]+)"', item)
        if not url_m:
            continue
        url = url_m.group(1).rstrip("/") + "/"

        # Główny obraz — preferuj src (pełna rozdzielczość), fallback do srcset
        img_m = re.search(r'<img[^>]+src="(https://mealpreponfleek\.com/wp-content/uploads/[^"]+)"', item)
        image_url = img_m.group(1) if img_m else ""

        # Usuń query string i thumbnail suffix z URL obrazka jeśli jest (zostaw oryginał)
        image_url = re.sub(r'-\d+x\d+(\.\w+)$', r'\1', image_url)

        name_m = re.search(r'class="fsri-title"[^>]*>(.*?)</div>', item, re.DOTALL)
        name = re.sub(r"\s+", " ", name_m.group(1)).strip() if name_m else ""
        if not name:
            continue

        cards.append({"url": url, "image_url": image_url, "name": name})

    return cards


def get_category_cards(base_url: str, category: str) -> list[dict]:
    """
    Pobiera wszystkie kafelki ze wszystkich stron paginacji kategorii.
    Zwraca listę {url, image_url, name, category}.
    """
    results: list[dict] = []
    seen_urls: set[str] = set()
    seen_pages: set[str] = set()
    page_url = base_url

    while page_url and page_url not in seen_pages:
        seen_pages.add(page_url)
        html = fetch(page_url)
        if not html:
            break

        cards = scrape_category_page(html)
        new = 0
        for card in cards:
            if card["url"] not in seen_urls:
                seen_urls.add(card["url"])
                card["category"] = category
                results.append(card)
                new += 1

        # Następna strona — rel="next"
        next_m = (re.search(r'rel="next"[^>]*href="([^"]+)"', html) or
                  re.search(r'href="([^"]+)"[^>]*rel="next"', html))
        page_url = next_m.group(1) if next_m else None

        if page_url:
            time.sleep(0.5 + random.uniform(0, 0.3))

    return results


# ── Pobieranie składników z przepisu ─────────────────────────────────────────

def _parse_servings(yield_val) -> int | None:
    """Parsuje recipeYield → liczba porcji."""
    if yield_val is None:
        return None
    if isinstance(yield_val, (int, float)):
        return int(yield_val)
    if isinstance(yield_val, list):
        yield_val = yield_val[0] if yield_val else ""
    m = re.search(r'\d+', str(yield_val))
    return int(m.group()) if m else None


def scrape_recipe(url: str) -> dict:
    """
    Pobiera stronę przepisu i wyciąga składniki + liczbę porcji z JSON-LD.
    Zwraca {"ingredients": [...], "servings": int|None}.
    """
    html = fetch(url)
    if not html:
        return {"ingredients": [], "servings": None}

    jsonld_blocks = re.findall(
        r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',
        html, re.DOTALL
    )

    for block in jsonld_blocks:
        try:
            data = json.loads(block)
        except Exception:
            continue

        items = data if isinstance(data, list) else data.get("@graph", [data])
        for item in items:
            if item.get("@type") == "Recipe":
                ings     = [i.strip() for i in item.get("recipeIngredient", []) if i.strip()]
                servings = _parse_servings(
                    item.get("recipeYield") or item.get("recipeServings")
                )
                return {"ingredients": ings, "servings": servings}

    return {"ingredients": [], "servings": None}


# ── Zapis / odczyt ────────────────────────────────────────────────────────────

def load_existing() -> dict[str, dict]:
    if OUTPUT_FILE.exists():
        try:
            return {r["url"]: r for r in json.loads(OUTPUT_FILE.read_text("utf-8"))}
        except Exception:
            pass
    return {}


def save_recipes(recipes: dict[str, dict]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(
        json.dumps(list(recipes.values()), ensure_ascii=False, indent=2),
        encoding="utf-8"
    )


def save_names(recipes: dict[str, dict]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    lines = [f"[{r['category']}] {r['name']}" for r in recipes.values()]
    NAMES_FILE.write_text("\n".join(lines), encoding="utf-8")


# ── Filtrowanie ───────────────────────────────────────────────────────────────

def filter_by_names() -> None:
    """
    Usuwa z JSON przepisy których linia '[kategoria] Nazwa' NIE MA w names.txt.
    """
    if not OUTPUT_FILE.exists():
        print("Brak pliku wynikowego. Najpierw uruchom scraper.")
        sys.exit(1)
    if not NAMES_FILE.exists():
        print(f"Brak {NAMES_FILE}. Najpierw uruchom scraper.")
        sys.exit(1)

    keep = {
        line.strip()
        for line in NAMES_FILE.read_text("utf-8").splitlines()
        if line.strip()
    }

    recipes = json.loads(OUTPUT_FILE.read_text("utf-8"))
    before = len(recipes)

    recipes = [
        r for r in recipes
        if f"[{r['category']}] {r['name']}" in keep
    ]
    after = len(recipes)

    OUTPUT_FILE.write_text(json.dumps(recipes, ensure_ascii=False, indent=2), "utf-8")
    NAMES_FILE.write_text(
        "\n".join(f"[{r['category']}] {r['name']}" for r in recipes), "utf-8"
    )

    print(f"Usunięto: {before - after} przepisów")
    print(f"Zostało:  {after} przepisów")
    print(f"Zapisano: {OUTPUT_FILE}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(description="Scraper mealpreponfleek.com")
    ap.add_argument("--limit",  type=int, default=None,
                    help="Max przepisów do pobrania łącznie (domyślnie: wszystkie)")
    ap.add_argument("--delay",  type=float, default=1.2,
                    help="Opóźnienie między żądaniami w sekundach (domyślnie: 1.2)")
    ap.add_argument("--filter", action="store_true",
                    help="Usuń z JSON przepisy nieobecne w mealpreponfleek_names.txt")
    ap.add_argument("--list",   action="store_true",
                    help="Pokaż co jest zapisane w pliku wynikowym")
    args = ap.parse_args()

    if args.filter:
        filter_by_names()
        return

    if args.list:
        if not OUTPUT_FILE.exists():
            print("Brak pliku wynikowego.")
            return
        recipes = json.loads(OUTPUT_FILE.read_text("utf-8"))
        for cat, label in [("breakfast","Breakfast"),("lunch","Lunch"),("dinner","Dinner"),
                            ("desserts","Desserts"),("snacks","Snacks")]:
            cat_recipes = [r for r in recipes if r["category"] == cat]
            print(f"\n{label} ({len(cat_recipes)}):")
            for r in cat_recipes:
                print(f"  {r['name']}")
        print(f"\nŁącznie: {len(recipes)}")
        return

    # ── Krok 1: zbierz karty ze wszystkich kategorii ──────────────────────────
    print("Zbieram linki z kategorii...")
    all_cards: list[dict] = []
    seen_urls: set[str] = set()

    for category, cat_url in CATEGORIES:
        print(f"  [{category}] {cat_url}")
        cards = get_category_cards(cat_url, category)
        new = [c for c in cards if c["url"] not in seen_urls]
        seen_urls.update(c["url"] for c in new)
        all_cards.extend(new)
        print(f"    → {len(cards)} przepisów (nowych: {len(new)})")

    print(f"\nŁącznie unikalnych przepisów: {len(all_cards)}")

    if args.limit:
        all_cards = all_cards[:args.limit]
        print(f"Limit: {args.limit}")

    # ── Krok 2: pobierz składniki dla każdego przepisu ────────────────────────
    existing = load_existing()
    new_count = skip_count = fail_count = 0

    print(f"\nPobieram składniki dla {len(all_cards)} przepisów...\n")

    for i, card in enumerate(all_cards, 1):
        url  = card["url"]
        name = card["name"]
        cat  = card["category"]

        # Re-scrape jeśli brak servings (nowe pole)
        if url in existing and existing[url].get("ingredients") and existing[url].get("servings") is not None:
            skip_count += 1
            print(f"[{i}/{len(all_cards)}] [{cat}] Pominięto: {name}")
            continue

        print(f"[{i}/{len(all_cards)}] [{cat}] {name}", end=" ", flush=True)
        result = scrape_recipe(url)
        ingredients = result["ingredients"]
        servings    = result["servings"]

        if ingredients:
            existing[url] = {
                "name":        name,
                "url":         url,
                "image_url":   card["image_url"],
                "category":    cat,
                "ingredients": ingredients,
                "servings":    servings,
            }
            new_count += 1
            srv = f" ({servings} porcji)" if servings else ""
            print(f"→ {len(ingredients)} skł.{srv}")
        else:
            fail_count += 1
            print("→ brak składników, pomijam")
            # Zapisz bez składników żeby nie pobierać ponownie
            existing[url] = {
                "name":        name,
                "url":         url,
                "image_url":   card["image_url"],
                "category":    cat,
                "ingredients": [],
            }

        if i % 10 == 0:
            save_recipes(existing)
            save_names(existing)

        time.sleep(args.delay + random.uniform(0, 0.5))

    save_recipes(existing)
    save_names(existing)

    by_cat = {}
    for r in existing.values():
        by_cat[r["category"]] = by_cat.get(r["category"], 0) + 1

    print("\nGotowe!")
    print(f"  Nowe:      {new_count}")
    print(f"  Pominięte: {skip_count}")
    print(f"  Błędy:     {fail_count}")
    for cat, count in by_cat.items():
        print(f"  {cat}: {count}")
    print(f"\n  Zapisano:  {OUTPUT_FILE}")
    print(f"  Nazwy:     {NAMES_FILE}")
    print("\nAby usunąć niechciane przepisy:")
    print(f"  1. Edytuj {NAMES_FILE.name} — usuń linie z niechcianymi przepisami")
    print("  2. Uruchom: python mealpreponfleek_scraper.py --filter")


if __name__ == "__main__":
    main()
