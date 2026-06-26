#!/usr/bin/env python3
"""
Auchan scraper — przechwytuje odpowiedzi API zakupy.auchan.pl.

Użycie:
    python auchan_scraper.py                 # scrape 3 kategorii → catalog_products.json
    python auchan_scraper.py --debug         # pokaż wszystkie przechwycone odpowiedzi API
    python auchan_scraper.py --limit 20      # max N produktów na kategorię
    python auchan_scraper.py --headful       # widoczna przeglądarka (do debugowania)
    python auchan_scraper.py --out wynik.json
"""


import asyncio
import json
import re
import sys
import argparse
import random
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "pipeline"))
from food_categories import classify_product

try:
    from playwright.async_api import async_playwright, Page
except ImportError:
    print("pip install playwright && playwright install chromium")
    sys.exit(1)

try:
    from playwright_stealth import Stealth
    _stealth = Stealth()
    HAS_STEALTH = True
except ImportError:
    HAS_STEALTH = False

def jitter(ms_min: int, ms_max: int) -> int:
    """Losowe opóźnienie w ms — symuluje ludzki timing."""
    return random.randint(ms_min, ms_max)

# ─── Kategorie ─────────────────────────────────────────────────────────────────

CATEGORIES = [
    ("Pewni Dobrego",                        "https://zakupy.auchan.pl/categories/zdrowa-%C5%BCywno%C5%9B%C4%87/pewni-dobrego/5106?source=navigation"),
    ("Owoce, warzywa i zioła",               "https://zakupy.auchan.pl/categories/artyku%C5%82y-spo%C5%BCywcze/owoce-warzywa-i-zio%C5%82a/2134?source=SUB_CATEGORY_IMAGE_CLICKED"),
    ("Mrożonki",                             "https://zakupy.auchan.pl/categories/artyku%C5%82y-spo%C5%BCywcze/mro%C5%BConki/2294?source=SUB_CATEGORY_IMAGE_CLICKED"),
    ("Mleko, nabiał i jaja",                 "https://zakupy.auchan.pl/categories/artyku%C5%82y-spo%C5%BCywcze/mleko-nabia%C5%82-i-jaja/2365?source=SUB_CATEGORY_IMAGE_CLICKED"),
    ("Mięso i drób",                         "https://zakupy.auchan.pl/categories/artyku%C5%82y-spo%C5%BCywcze/mi%C4%99so-i-dr%C3%B3b/2446?source=SUB_CATEGORY_IMAGE_CLICKED"),
    ("Sery",                                 "https://zakupy.auchan.pl/categories/artyku%C5%82y-spo%C5%BCywcze/sery/2534?source=SUB_CATEGORY_IMAGE_CLICKED"),
    ("Sypkie i produkty zbożowe",            "https://zakupy.auchan.pl/categories/artyku%C5%82y-spo%C5%BCywcze/sypkie-i-produkty-zbo%C5%BCowe/4710?source=SUB_CATEGORY_IMAGE_CLICKED"),
    ("Konserwy, przetwory i dod. kulinarne", "https://zakupy.auchan.pl/categories/artyku%C5%82y-spo%C5%BCywcze/konserwy-przetwory-i-dodatki-kulinarne/4563?source=SUB_CATEGORY_IMAGE_CLICKED"),
    ("Bakalie i suszone owoce",              "https://zakupy.auchan.pl/categories/artyku%C5%82y-spo%C5%BCywcze/bakalie/2222?source=SUB_CATEGORY_IMAGE_CLICKED"),
]

# Poziom 3 — Windows UA (bardziej powszechny niż Linux)
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# Domeny do zignorowania przy intercepcji
SKIP_DOMAINS = (
    "analytics", "tracking", "gtm.", "google-analytics", "facebook.net",
    "doubleclick", "hotjar", "segment.io", "newrelic", "sentry",
    "clarity.ms", "bing.com", "twitter", "tiktok",
)

# ─── Parsowanie wagi z nazwy produktu ──────────────────────────────────────────

WEIGHT_RE = [
    (re.compile(r"(\d+(?:[.,]\d+)?)\s*kg\b",          re.I), 1000, "g"),
    (re.compile(r"(\d+(?:[.,]\d+)?)\s*dag\b",         re.I), 10,   "g"),
    (re.compile(r"(\d+(?:[.,]\d+)?)\s*g\b",           re.I), 1,    "g"),
    (re.compile(r"(\d+(?:[.,]\d+)?)\s*l\b(?![a-z])",  re.I), 1000, "ml"),
    (re.compile(r"(\d+(?:[.,]\d+)?)\s*ml\b",          re.I), 1,    "ml"),
    (re.compile(r"\b(\d+)\s*(?:szt|sztuk|torebek|torebki|kapsułek|tabl)\b", re.I), 1, "szt"),
]

def parse_weight(name: str) -> tuple[float, str]:
    for pattern, mult, unit in WEIGHT_RE:
        m = pattern.search(name)
        if m:
            val = float(m.group(1).replace(",", ".")) * mult
            return round(val, 1), unit
    return 100.0, "g"   # fallback


def norm_unit(val: float, raw: str) -> tuple[float, str]:
    u = raw.lower().strip()
    if "kg" in u:   return round(val * 1000, 1), "g"
    if "dag" in u:  return round(val * 10, 1),   "g"
    if u in ("l", "litr", "liter", "litre"): return round(val * 1000, 1), "ml"
    if "ml" in u:   return round(val, 1), "ml"
    if u in ("szt", "pcs", "piece", "sztuka", "op"): return round(val), "szt"
    return round(val, 1), "g"


# ─── Ekstrakcja produktu — format Auchan webproductpagews/v6 ──────────────────
#
# Struktura pola:
#   name:             str
#   price:            {'amount': '3.45', 'currency': 'PLN'}   ← amount to STRING
#   promoPrice:       {'amount': '2.99', ...}  (opcjonalne — cena promocyjna)
#   unitPrice:        {'price': {'amount': '27.60', ...}, 'unit': 'fop.price.per.kg'}
#   promoUnitPrice:   {'price': {'amount': '23.92', ...}, 'unit': 'fop.price.per.kg'}
#   packSizeDescription: '0.125kg'  (lub brak)
#   alcohol:          bool

UNIT_LABEL = {
    "fop.price.per.kg":   "kg",
    "fop.price.per.l":    "l",
    "fop.price.per.100g": "100g",
    "fop.price.per.100ml":"100ml",
    "fop.price.per.each": "szt",
    "fop.price.per.piece":"szt",
}

def _parse_amount(obj) -> float | None:
    """Parsuje {'amount': '3.45', ...} albo liczbę do float."""
    if isinstance(obj, (int, float)):
        return float(obj) if obj > 0 else None
    if isinstance(obj, dict):
        raw = obj.get("amount") or obj.get("value")
        if raw is not None:
            try:
                v = float(str(raw).replace(",", "."))
                return v if v > 0 else None
            except ValueError:
                pass
    return None


def extract_auchan_product(item: dict) -> dict | None:
    """Parser specjalnie dla formatu Auchan webproductpagews/v6/products."""
    if not isinstance(item, dict):
        return None

    name = item.get("name", "").strip()
    if not name or len(name) < 3:
        return None

    # Cena — użyj ceny promocyjnej jeśli dostępna, inaczej zwykłej
    price_obj = item.get("promoPrice") or item.get("price")
    price = _parse_amount(price_obj)
    if not price or price > 5000:
        return None

    # Cena jednostkowa (np. "27.60 zł/kg")
    up_obj = item.get("promoUnitPrice") or item.get("unitPrice")
    unit_price_str = ""
    if isinstance(up_obj, dict):
        up_amount = _parse_amount(up_obj.get("price"))
        up_unit_raw = up_obj.get("unit", "")
        up_label = UNIT_LABEL.get(up_unit_raw, up_unit_raw.replace("fop.price.per.", ""))
        if up_amount and up_label:
            unit_price_str = f"{up_amount:.2f} zł/{up_label}"

    # Rozmiar opakowania z packSizeDescription ('0.125kg') lub z nazwy
    sold_by_weight = bool(re.search(r"\bna\s+wag[ęe]\b", name, re.I))
    pkg_weight, pkg_unit = 1000.0, "g"  # default dla na wagę

    if not sold_by_weight:
        pack_desc = item.get("packSizeDescription", "")
        if pack_desc:
            m = re.match(r"([\d.,]+)\s*(kg|dag|g|l|ml|szt)", pack_desc.strip(), re.I)
            if m:
                pkg_weight, pkg_unit = norm_unit(float(m.group(1).replace(",", ".")), m.group(2))
            else:
                pkg_weight, pkg_unit = parse_weight(name)
        else:
            pkg_weight, pkg_unit = parse_weight(name)

    package_size = "Na wagę" if sold_by_weight else f"{int(pkg_weight)}{pkg_unit}"

    return {
        "name":           name[:200],
        "package_size":   package_size,
        "price":          round(price, 2),
        "price_per_unit": unit_price_str,
        "sold_by_weight": sold_by_weight,
        "_category":      "",
    }


# ─── Ogólna ekstrakcja (fallback dla innych formatów) ─────────────────────────

NAME_KEYS  = ("displayName", "name", "title", "productName", "label", "shortName", "fullName")
PRICE_KEYS = ("regularPrice", "salePrice", "offerPrice", "finalPrice",
              "priceValue", "price_value", "listPrice", "basePrice")
INNER_KEYS = ("value", "amount", "regularPrice", "gross", "salesPrice", "sellPrice", "net")
WEIGHT_KEYS = (("grammage", "grammageUnit"), ("netContent", "netContentUnit"),
               ("weightValue", "weightUnit"), ("packageSize", "packageUnit"),
               ("contentSize", "contentUnit"))
SBW_KEYS   = ("soldByWeight", "sold_by_weight", "isByWeight", "byWeight", "weightBased")
SBW_UNITS  = {"kg", "kilogram", "kilo"}

def extract_product(item: dict) -> dict | None:
    if not isinstance(item, dict):
        return None

    # Nazwa
    name = next(
        (str(item[k]).strip() for k in NAME_KEYS
         if k in item and isinstance(item[k], str) and len(item[k]) > 2),
        None,
    )
    if not name:
        return None

    # Cena opakowania
    price = None
    raw_p = item.get("price")
    if isinstance(raw_p, (int, float)) and raw_p > 0:
        price = float(raw_p)
    elif isinstance(raw_p, dict):
        price = next(
            (float(raw_p[k]) for k in INNER_KEYS
             if k in raw_p and isinstance(raw_p[k], (int, float)) and raw_p[k] > 0),
            None,
        )
    if price is None:
        price = next(
            (float(item[k]) for k in PRICE_KEYS
             if k in item and isinstance(item[k], (int, float)) and item[k] > 0),
            None,
        )
    if price is None and "priceInteger" in item:
        try:
            price = float(f"{item['priceInteger']}.{str(item.get('priceDecimal', 0)).zfill(2)}")
        except Exception:
            pass
    if not price or price <= 0 or price > 5000:
        return None

    # Sprzedaż na wagę
    sold_by_weight = any(item.get(k) for k in SBW_KEYS)
    if not sold_by_weight:
        for k in ("priceUnit", "unitOfMeasure", "pricingUnit", "sellUnit", "priceType"):
            if str(item.get(k, "")).lower().strip() in SBW_UNITS:
                sold_by_weight = True
                break

    # Rozmiar opakowania
    pkg_weight, pkg_unit = None, "g"
    for wk, uk in WEIGHT_KEYS:
        if wk in item and isinstance(item[wk], (int, float)) and item[wk] > 0:
            pkg_weight, pkg_unit = norm_unit(float(item[wk]), str(item.get(uk, "g") or "g"))
            break
    if pkg_weight is None:
        pkg_weight, pkg_unit = parse_weight(name)
    if sold_by_weight:
        pkg_weight, pkg_unit = 1000.0, "g"

    # Cena jednostkowa
    unit_price_str = ""
    for k in ("pricePerUnit", "unitPrice", "grammagePrice", "pricePerKg", "price_per_unit"):
        v = item.get(k)
        if isinstance(v, str) and v.strip():
            unit_price_str = v.strip()
            break
        elif isinstance(v, dict):
            val = v.get("value") or v.get("amount")
            unt = v.get("unit", "")
            if val:
                unit_price_str = f"{val:.2f} zł/{unt}".rstrip("/")
            break
    if not unit_price_str and pkg_weight and pkg_weight > 0 and not sold_by_weight:
        if pkg_unit in ("g", "ml"):
            label = "kg" if pkg_unit == "g" else "l"
            unit_price_str = f"{price / pkg_weight * 1000:.2f} zł/{label}"

    package_size = "Na wagę" if sold_by_weight else f"{int(pkg_weight)}{pkg_unit}"

    return {
        "name":           name[:200],
        "package_size":   package_size,
        "price":          round(price, 2),
        "price_per_unit": unit_price_str,
        "sold_by_weight": sold_by_weight,
        "_category":      "",   # uzupełniane przez wywołującego
    }


# ─── Rekurencyjne wyszukiwanie produktów w JSON ─────────────────────────────

PRODUCT_LIST_KEYS = {
    "products", "items", "results", "searchResults", "resultsList",
    "productsList", "entries", "data", "hits", "documents",
    "productList", "Products", "Items", "catalogue", "records",
    "edges",  # GraphQL
}

def search_json(data, depth: int = 0) -> list[dict]:
    if depth > 12:
        return []
    found = []
    if isinstance(data, list):
        for item in data:
            p = extract_product(item)
            if p:
                found.append(p)
            elif isinstance(item, (dict, list)):
                found.extend(search_json(item, depth + 1))
    elif isinstance(data, dict):
        # GraphQL edges/node
        if "edges" in data and isinstance(data["edges"], list):
            for edge in data["edges"]:
                if isinstance(edge, dict) and "node" in edge:
                    p = extract_product(edge["node"])
                    if p:
                        found.append(p)
        for key, val in data.items():
            if key in PRODUCT_LIST_KEYS and isinstance(val, (list, dict)):
                sub = search_json(val, depth)
                if sub:
                    found.extend(sub)
                    continue
            if isinstance(val, (dict, list)):
                found.extend(search_json(val, depth + 1))
    return found


# ─── Scraping jednej kategorii ────────────────────────────────────────────────

async def scrape_category(
    page: Page,
    cat_name: str,
    url: str,
    limit: int = 0,
    debug: bool = False,
) -> list[dict]:
    intercepted: list[dict] = []
    seen_names: set[str] = set()

    async def on_response(resp):
        if "json" not in resp.headers.get("content-type", ""):
            return
        if any(d in resp.url for d in SKIP_DOMAINS):
            return
        try:
            body = await resp.json()
        except Exception:
            return

        if debug:
            url_short = resp.url[:100]
            print(f"\n    [API] {url_short}")
            if isinstance(body, dict):
                for k, v in body.items():
                    size = len(v) if isinstance(v, (list, dict)) else ""
                    print(f"          {k}: {type(v).__name__} {size}")
                # Jeśli to endpoint produktów — pokaż strukturę pierwszego produktu
                if "webproductpagews" in resp.url or "products" in body:
                    prods = body.get("products") or []
                    if prods and isinstance(prods, list) and isinstance(prods[0], dict):
                        print(f"\n    [PRODUKT #0 — surowa struktura]:")
                        for k, v in list(prods[0].items())[:30]:
                            print(f"          {k!r}: {v!r}"[:120])

        # Auchan webproductpagews — użyj dedykowanego parsera
        if "webproductpagews" in resp.url and isinstance(body, dict):
            found = [
                p for raw in body.get("products", [])
                if (p := extract_auchan_product(raw)) is not None
            ]
        else:
            try:
                found = search_json(body)
            except Exception:
                found = []

        for p in found:
            n = p["name"].lower()
            if n not in seen_names:
                seen_names.add(n)
                p["_category"] = cat_name
                intercepted.append(p)

    page.on("response", on_response)
    print(f"  [{cat_name}] ładuję...", end="", flush=True)

    # Poziom 2 — ludzki scroll w tle podczas oczekiwania na API
    async def human_scroll_bg():
        """Scrolluje stopniowo — wyzwala product API gdy grid wchodzi w viewport."""
        await page.wait_for_timeout(jitter(1500, 2500))
        pos = 0
        for _ in range(12):
            pos += random.randint(200, 400)
            await page.evaluate(f"window.scrollTo(0, {pos})")
            await page.wait_for_timeout(jitter(350, 700))

    # expect_response czeka WYŁĄCZNIE na webproductpagews (nie graphql — graphql nie ma produktów)
    # Timeout 55s bo "Karmienie dziecka" ładuje produkty dopiero po ~14s od page load
    try:
        async with page.expect_response(
            lambda r: "webproductpagews" in r.url and r.status == 200,
            timeout=55000,
        ) as resp_info:
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=40000)
            except Exception:
                pass
            await human_scroll_bg()
            # Czekaj dalej jeśli scroll się skończył ale API jeszcze nie odpowiedziało
            # (Karmienie dziecka ładuje produkty po ~14s — scrollujemy jeszcze raz)
            if not intercepted:
                await page.wait_for_timeout(jitter(2000, 3000))
                await human_scroll_bg()

        # Przetwórz pierwszą odpowiedź webproductpagews
        first_resp = await resp_info.value
        body = await first_resp.json()
        for raw in body.get("products", []):
            p = extract_auchan_product(raw)
            if p and p["name"].lower() not in seen_names:
                seen_names.add(p["name"].lower())
                p["_category"] = cat_name
                intercepted.append(p)

    except Exception:
        # Timeout lub błąd — fallback
        if not intercepted:
            try:
                await page.goto(url, wait_until="load", timeout=40000)
            except Exception as e:
                print(f" ❌ {e}")
                page.remove_listener("response", on_response)
                return []
            await human_scroll_bg()
            await page.wait_for_timeout(jitter(4000, 7000))

    # Sprawdź __NEXT_DATA__ (Next.js SSR — często ma produkty bez dodatkowych requestów)
    try:
        nd_str = await page.evaluate("() => { const d = window.__NEXT_DATA__; return d ? JSON.stringify(d) : null; }")
        if nd_str:
            nd = json.loads(nd_str)
            found = search_json(nd)
            for p in found:
                n = p["name"].lower()
                if n not in seen_names:
                    seen_names.add(n)
                    p["_category"] = cat_name
                    intercepted.append(p)
            if found and debug:
                print(f"\n    [__NEXT_DATA__] znaleziono {len(found)} produktów")
    except Exception:
        pass

    # Paginacja / infinite scroll
    prev_count = len(intercepted)
    stable = 0
    max_pages = 30

    for page_num in range(max_pages):
        if limit and len(intercepted) >= limit:
            break

        # Stopniowy scroll przez viewport — wyzwala infinite scroll Auchan
        # (skok scrollTo(0, scrollHeight) nie triggeruje lazy load)
        vh = await page.evaluate("window.innerHeight || 768")
        steps = random.randint(3, 5)
        for _ in range(steps):
            await page.evaluate(f"window.scrollBy(0, {vh * random.uniform(0.7, 1.1):.0f})")
            await page.wait_for_timeout(jitter(500, 900))
        await page.wait_for_timeout(jitter(1500, 2500))

        cur_count = len(intercepted)
        if cur_count == prev_count:
            stable += 1
            if stable >= 4:
                break   # brak nowych produktów — koniec
        else:
            stable = 0
        prev_count = cur_count

    page.remove_listener("response", on_response)

    products = intercepted[:limit] if limit else intercepted
    print(f" → {len(products)} produktów")
    return products


# ─── Główna pętla ─────────────────────────────────────────────────────────────

async def main(args):
    all_products: list[dict] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=not args.headful,
            args=["--disable-blink-features=AutomationControlled"],
        )
        # Poziom 3 — pełny kontekst z timezone, locale, realistyczny viewport
        ctx = await browser.new_context(
            user_agent=UA,
            viewport={"width": 1366, "height": 768},   # popularna rozdzielczość
            locale="pl-PL",
            timezone_id="Europe/Warsaw",
            extra_http_headers={
                "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
        )
        page = await ctx.new_page()

        # Poziom 4 — stealth: ukrywa navigator.webdriver i inne fingerprints Playwright
        if HAS_STEALTH:
            await _stealth.apply_stealth_async(page)
            print("  ✓ stealth aktywny")

        # Akceptacja cookies na pierwszej stronie
        print("Otwieranie Auchan (akceptacja cookies)...")
        try:
            await page.goto(CATEGORIES[0][1], wait_until="load", timeout=40000)
            await page.wait_for_timeout(2000)
            for sel in (
                "button#onetrust-accept-btn-handler",
                "button[id*='accept'][id*='cookie' i]",
                "button[class*='accept'][class*='cookie' i]",
                "[aria-label*='Akceptuj' i]",
                "[aria-label*='Accept all' i]",
            ):
                try:
                    btn = await page.query_selector(sel)
                    if btn and await btn.is_visible():
                        await btn.click()
                        await page.wait_for_timeout(1000)
                        print("  ✓ cookies zaakceptowane")
                        break
                except Exception:
                    pass
        except Exception as e:
            print(f"  ⚠ błąd otwarcia pierwszej strony: {e}")

        print()
        for cat_name, cat_url in CATEGORIES:
            try:
                products = await scrape_category(page, cat_name, cat_url, args.limit, args.debug)
                all_products.extend(products)
                if not products:
                    print(f"    ⚠ 0 produktów — sprawdź URL lub uruchom z --debug --headful")
            except Exception as e:
                print(f"  ❌ {cat_name}: {e}")
            # Poziom 1 — losowe opóźnienie między kategoriami
            await page.wait_for_timeout(jitter(3000, 6000))

        await browser.close()

    # Klasyfikuj do 12 standardowych kategorii i filtruj
    classified = []
    skipped    = 0
    for p in all_products:
        result = classify_product(p)
        if result:
            classified.append(result)
        else:
            skipped += 1

    output_path = Path(args.out)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(classified, f, ensure_ascii=False, indent=2)

    by_cat: dict[str, int] = {}
    for p in classified:
        c = p["standard_category"]
        by_cat[c] = by_cat.get(c, 0) + 1

    print(f"\n{'='*60}")
    print(f"Łącznie:     {len(all_products)} produktów")
    print(f"Dopasowane:  {len(classified)}")
    print(f"Odrzucone:   {skipped}")
    for cat, count in sorted(by_cat.items(), key=lambda x: -x[1]):
        print(f"  {count:4d}  {cat}")
    print(f"Zapisano → {output_path}")

    if not all_products:
        print("\n⚠  Nie znaleziono żadnych produktów.")
        print("   Uruchom z --debug żeby zobaczyć jakie odpowiedzi API przechwytuje scraper.")
        print("   Uruchom z --headful żeby obserwować przeglądarkę.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Auchan catalog scraper")
    ap.add_argument("--limit",   type=int, default=0,   help="Max produktów na kategorię (0=bez limitu)")
    ap.add_argument("--debug",   action="store_true",   help="Pokaż przechwycone odpowiedzi API")
    ap.add_argument("--headful", action="store_true",   help="Widoczna przeglądarka")
    ap.add_argument("--out",     default=str(Path(__file__).parent.parent / "data" / "auchan_products.json"), help="Plik wyjściowy")
    asyncio.run(main(ap.parse_args()))
