"""
Scraper przepisów z aniagotuje.pl

Pobiera przepisy (nazwa + składniki) i zapisuje do JSON.
Składniki są parsowane do formatu CSV zgodnego z importem w aplikacji.

Użycie:
    # Pobierz 20 pierwszych przepisów z sitemapa:
    python aniagotuje_scraper.py --limit 20

    # Szukaj przepisów zawierających słowo kluczowe w nazwie URL:
    python aniagotuje_scraper.py --search kurczak --limit 50

    # Pobierz wszystkie przepisy (zajmie ~1-2h):
    python aniagotuje_scraper.py --all

    # Pokaż co jest w wynikowym pliku JSON:
    python aniagotuje_scraper.py --list-results

Wynik zapisywany jest do aniagotuje_recipes.json.
Możesz potem zaimportować go do aplikacji przez:
    python aniagotuje_import.py
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

OUTPUT_FILE = Path(__file__).parent / "aniagotuje_recipes.json"
SITEMAP_URL = "https://aniagotuje.pl/sitemap.xml"
BASE_URL    = "https://aniagotuje.pl/przepis/"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pl-PL,pl;q=0.9",
}

# ── Jednostki rozpoznawane przez parser ──────────────────────────────────────
UNITS_WEIGHT  = {"g", "kg", "dag"}
UNITS_VOLUME  = {"ml", "l", "dl"}
UNITS_COUNT   = {"szt", "sztuka", "sztuk", "sztuki"}
UNITS_SPOON   = {"łyżka", "łyżki", "łyżkę", "łyżek", "łyżce"}
UNITS_TSP     = {"łyżeczka", "łyżeczki", "łyżeczkę", "łyżeczek"}
UNITS_CUP     = {"szklanka", "szklanki", "szklankę", "szklanek"}
UNITS_PINCH   = {"szczypta", "szczypcie", "szczypty"}
UNITS_BUNCH   = {"garść", "garści"}
UNITS_PKG     = {"opakowanie", "opakowania", "puszka", "puszki", "słoiczek",
                 "słoiczka", "torebka", "torebki", "butelka", "butelki",
                 "kostka", "kostki"}
UNITS_PIECE   = {"kawałek", "kawałki", "ząbek", "ząbki", "plaster", "plastry",
                 "liść", "listek", "listki", "gałązka", "gałązki"}

ALL_UNITS = (UNITS_WEIGHT | UNITS_VOLUME | UNITS_COUNT | UNITS_SPOON |
             UNITS_TSP | UNITS_CUP | UNITS_PINCH | UNITS_BUNCH |
             UNITS_PKG | UNITS_PIECE)

# Normalizacja jednostki do postaci kanonicznej
UNIT_NORMALIZE = {}
for u in UNITS_WEIGHT:  UNIT_NORMALIZE[u] = u   # g/kg/dag bez zmian
for u in UNITS_VOLUME:  UNIT_NORMALIZE[u] = u
for u in UNITS_COUNT:   UNIT_NORMALIZE[u] = "szt"
for u in UNITS_SPOON:   UNIT_NORMALIZE[u] = "łyżka"
for u in UNITS_TSP:     UNIT_NORMALIZE[u] = "łyżeczka"
for u in UNITS_CUP:     UNIT_NORMALIZE[u] = "szklanka"
for u in UNITS_PINCH:   UNIT_NORMALIZE[u] = "szczypta"
for u in UNITS_BUNCH:   UNIT_NORMALIZE[u] = "garść"
for u in UNITS_PKG:     UNIT_NORMALIZE[u] = "szt"
for u in UNITS_PIECE:   UNIT_NORMALIZE[u] = "szt"

# Słowa ułamkowe → liczba
FRACTION_WORDS = {
    "pół": 0.5, "ćwierć": 0.25, "trzy": 3, "cztery": 4, "pięć": 5,
    "dwie": 2, "dwa": 2, "jeden": 1, "jedna": 1, "jedno": 1,
    "kilka": 3, "parę": 3,
}


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


def get_sitemap_urls(search: str | None = None) -> list[str]:
    print("Pobieranie sitemapa...", flush=True)
    html = fetch(SITEMAP_URL)
    if not html:
        print("Błąd: nie można pobrać sitemapa.", file=sys.stderr)
        sys.exit(1)
    urls = re.findall(r"<loc>(https://aniagotuje\.pl/przepis/[^<]+)</loc>", html)
    if search:
        urls = [u for u in urls if search.lower() in u.lower()]
    print(f"  Znaleziono {len(urls)} URL{'ów' if len(urls) != 1 else ''}"
          + (f" pasujących do '{search}'" if search else ""))
    return urls


def parse_quantity(text: str) -> float | None:
    """Zamienia tekst liczby (np. '1', '0.5', 'pół', '1/2') na float."""
    text = text.strip().lower().replace(",", ".")
    if text in FRACTION_WORDS:
        return FRACTION_WORDS[text]
    # ułamek zapisany jako 1/2
    frac = re.match(r"^(\d+)\s*/\s*(\d+)$", text)
    if frac:
        return int(frac.group(1)) / int(frac.group(2))
    try:
        return float(text)
    except ValueError:
        return None


def parse_ingredient(raw: str) -> dict | None:
    """
    Parsuje tekst składnika do {name, ilosc, jednostka}.

    Strategie (próbowane po kolei):
    1. Szuka alternatywnej miary w gramach/ml po " - " lub " (":
       "2 szklanki mąki - 240 g" → ilosc=240, jednostka=g, name=mąka
    2. Standardowy format: LICZBA JEDNOSTKA NAZWA
    3. NAZWA - LICZBA JEDNOSTKA (np. "cebula - 100 g")
    4. Jeśli nie da się sparsować — zwraca name=raw, ilosc=1, jednostka=szt
    """
    raw = raw.strip()
    # Usuń gwiazdki i przypisy w nawiasach kwadratowych
    raw = re.sub(r"\s*\*.*$", "", raw)
    raw = re.sub(r"\s*\[.*?\]", "", raw)
    # Usuń "około ", "ok. "
    cleaned = re.sub(r"\b(około|ok\.)\s*", "", raw, flags=re.IGNORECASE)

    units_pat = "|".join(sorted(ALL_UNITS, key=len, reverse=True))

    # ── Strategia 1: alternatywna miara po " - " np. "2 szklanki - 240 g" ──
    alt = re.search(
        rf"-\s*(?:około\s*)?(\d+(?:[.,]\d+)?)\s*({units_pat})\s*$",
        cleaned, re.IGNORECASE
    )
    if alt:
        qty = parse_quantity(alt.group(1))
        unit = UNIT_NORMALIZE.get(alt.group(2).lower(), alt.group(2).lower())
        if qty is not None and unit in {"g", "kg", "ml", "l"}:
            # Nazwa: to co przed " - " bez liczby i jednostki na początku
            prefix = cleaned[:alt.start()].strip()
            prefix = re.sub(
                rf"^(\d+(?:[.,]\d+)?|pół|ćwierć|dwie?|trzy|cztery)\s*({units_pat})\s*",
                "", prefix, flags=re.IGNORECASE
            ).strip(" -")
            name = prefix if prefix else raw
            return {"name": name, "ilosc": qty, "jednostka": unit}

    # ── Strategia 2: LICZBA/UŁAMEK JEDNOSTKA NAZWA ──────────────────────────
    m = re.match(
        rf"^(pół|ćwierć|dwie?|trzy|cztery|pięć|\d+(?:[.,]\d+)?(?:\s*/\s*\d+)?)\s+({units_pat})\s+(.*)",
        cleaned, re.IGNORECASE
    )
    if m:
        qty  = parse_quantity(m.group(1))
        unit = UNIT_NORMALIZE.get(m.group(2).lower(), m.group(2).lower())
        name = m.group(3).strip().strip("-").strip()
        # Usuń zdania wyjaśniające po ":" lub po " - "
        name = re.split(r"\s*[:;]\s*u mnie|\s+-\s+\d", name)[0].strip()
        if qty is not None:
            return {"name": name, "ilosc": qty, "jednostka": unit}

    # ── Strategia 3: NAZWA - LICZBA JEDNOSTKA ────────────────────────────────
    m2 = re.search(
        rf"(.+?)\s+-\s+(\d+(?:[.,]\d+)?)\s*({units_pat})\s*$",
        cleaned, re.IGNORECASE
    )
    if m2:
        qty  = parse_quantity(m2.group(2))
        unit = UNIT_NORMALIZE.get(m2.group(3).lower(), m2.group(3).lower())
        name = m2.group(1).strip()
        if qty is not None:
            return {"name": name, "ilosc": qty, "jednostka": unit}

    # ── Strategia 4: sama liczba bez jednostki ("3 jajka") ──────────────────
    m3 = re.match(r"^(\d+(?:[.,]\d+)?)\s+(.*)", cleaned)
    if m3:
        qty  = parse_quantity(m3.group(1))
        name = m3.group(2).strip()
        if qty is not None and name:
            return {"name": name, "ilosc": qty, "jednostka": "szt"}

    # ── Strategia 5: nie da się sparsować — zwróć surowy tekst ──────────────
    return {"name": raw, "ilosc": 1, "jednostka": "szt"}


def to_csv_line(ing: dict) -> str:
    ilosc = ing["ilosc"]
    ilosc_str = str(int(ilosc)) if ilosc == int(ilosc) else str(ilosc)
    # Przecinki w nazwie zastępujemy spacją — CSV używa przecinka jako separatora
    name = ing["name"].replace(",", " ")
    return f"{name},{ilosc_str},{ing['jednostka']}"


def scrape_recipe(url: str) -> dict | None:
    html = fetch(url)
    if not html:
        return None

    # Nazwa przepisu
    h1 = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.DOTALL)
    name = re.sub(r"<[^>]+>", "", h1.group(1)).strip() if h1 else ""
    if not name:
        return None

    # Obraz (og:image)
    img = re.search(r'property="og:image"\s+content="([^"]+)"', html)
    if not img:
        img = re.search(r'content="([^"]+)"\s+property="og:image"', html)
    image_url = img.group(1) if img else ""

    # Składniki
    raw_ingredients = re.findall(
        r'<span[^>]*class="ingredient"[^>]*>(.*?)</span>',
        html, re.DOTALL | re.IGNORECASE
    )
    raw_ingredients = [re.sub(r"<[^>]+>", "", r).strip() for r in raw_ingredients]
    raw_ingredients = [r for r in raw_ingredients if r]

    if not raw_ingredients:
        return None

    parsed = [parse_ingredient(r) for r in raw_ingredients]

    csv_lines = ["nazwa,ilosc,jednostka"] + [to_csv_line(p) for p in parsed]

    # Makra per 100g (itemprop microdata)
    def _num(itemprop: str) -> float | None:
        m = re.search(rf'itemprop="{itemprop}"[^>]*>([\d.,]+)', html)
        if not m:
            m = re.search(rf'itemprop="{itemprop}">([\d.,]+)', html)
        return round(float(m.group(1).replace(",", ".")), 1) if m else None

    macros = {
        "kcal_100g":    _num("calories"),
        "protein_100g": _num("proteinContent"),
        "fat_100g":     _num("fatContent"),
        "carbs_100g":   _num("carbohydrateContent"),
    }

    return {
        "name":             name,
        "url":              url,
        "image_url":        image_url,
        "ingredients_csv":  "\n".join(csv_lines),
        "ingredients_raw":  raw_ingredients,
        **{k: v for k, v in macros.items() if v is not None},
    }


def load_existing() -> dict[str, dict]:
    if OUTPUT_FILE.exists():
        try:
            return {r["url"]: r for r in json.loads(OUTPUT_FILE.read_text("utf-8"))}
        except Exception:
            pass
    return {}


def save(recipes: dict[str, dict]) -> None:
    OUTPUT_FILE.write_text(
        json.dumps(list(recipes.values()), ensure_ascii=False, indent=2),
        encoding="utf-8"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Scraper przepisów aniagotuje.pl")
    parser.add_argument("--search",  metavar="SŁOWO",
                        help="Filtruj przepisy po słowie kluczowym w URL (np. kurczak, zupa)")
    parser.add_argument("--limit",   type=int, default=None,
                        help="Maksymalna liczba przepisów do pobrania")
    parser.add_argument("--all",     action="store_true",
                        help="Pobierz wszystkie przepisy (ok. 2200, zajmie ~1-2h)")
    parser.add_argument("--list-results", action="store_true",
                        help="Pokaż przepisy już pobrane w pliku wynikowym")
    parser.add_argument("--delay",   type=float, default=1.5,
                        help="Opóźnienie między żądaniami w sekundach (domyślnie: 1.5)")
    args = parser.parse_args()

    # Pokaż wyniki
    if args.list_results:
        if not OUTPUT_FILE.exists():
            print("Brak pliku wynikowego. Najpierw uruchom scraper.")
            return
        recipes = json.loads(OUTPUT_FILE.read_text("utf-8"))
        print(f"Zapisanych przepisów: {len(recipes)}\n")
        for r in recipes:
            n_ing = len(r["ingredients_raw"])
            print(f"  {r['name']} ({n_ing} składników) — {r['url']}")
        return

    if not args.all and args.limit is None:
        args.limit = 20
        print("Wskazówka: domyślnie pobieramy 20 przepisów. Użyj --all lub --limit N.")

    urls   = get_sitemap_urls(args.search)
    if args.limit:
        urls = urls[:args.limit]

    existing = load_existing()
    new_count = 0
    skip_count = 0

    print(f"\nRozpoczynamy pobieranie {len(urls)} przepisów...\n")

    for i, url in enumerate(urls, 1):
        slug = url.split("/")[-1]

        if url in existing:
            skip_count += 1
            print(f"[{i}/{len(urls)}] Pominięto (już w bazie): {slug}")
            continue

        print(f"[{i}/{len(urls)}] Pobieranie: {slug}", end=" ", flush=True)
        recipe = scrape_recipe(url)

        if recipe:
            existing[url] = recipe
            new_count += 1
            n_ing = len(recipe["ingredients_raw"])
            print(f"→ {recipe['name']} ({n_ing} skł.)")
        else:
            print("→ pominięto (brak składników lub błąd)")

        # Co 10 przepisów zapisuj plik
        if i % 10 == 0:
            save(existing)

        # Uprzejme opóźnienie + losowy jitter żeby nie wyglądało jak bot
        time.sleep(args.delay + random.uniform(0, 0.8))

    save(existing)
    print(f"\nGotowe! Nowe: {new_count}, pominięte: {skip_count}.")
    print(f"Wynik zapisany w: {OUTPUT_FILE}")
    print(f"\nAby zaimportować do aplikacji, uruchom:")
    print(f"  python aniagotuje_import.py")


if __name__ == "__main__":
    main()
