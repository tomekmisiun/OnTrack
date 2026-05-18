#!/usr/bin/env python3
"""
Catalog scraper — produkty spożywcze z Auchan, Biedronka, Carrefour.

Metoda: Playwright + przechwytywanie odpowiedzi JSON (API interception).
Każdy sklep ładuje produkty przez własne API podczas otwierania kategorii —
scraper przechwytuje te odpowiedzi i wyciąga dane.
Fallback: bezpośrednie parsowanie DOM jeśli API nic nie zwróci.

WYKLUCZONE: alkohole, chemia, środki czystości, zwierzęta, biuro/szkoła,
            dom i ogród, auto-moto, dziecko/mama (poza karmieniem niemowląt).

Użycie:
    # Podgląd — pokaż co by znalazł, nie zapisuj do bazy
    python catalog_scraper.py --scrape auchan --dry-run
    python catalog_scraper.py --scrape auchan --dry-run --limit 10

    # Scrape jednego sklepu → zapisz JSON → zaimportuj do bazy
    python catalog_scraper.py --scrape auchan
    python catalog_scraper.py --scrape biedronka
    python catalog_scraper.py --scrape carrefour
    python catalog_scraper.py --scrape all

    # Importuj z zapisanego pliku JSON do bazy
    python catalog_scraper.py --import catalog_products.json

    # Debugowanie konkretnej kategorii (uruchamia widoczną przeglądarkę)
    python catalog_scraper.py --inspect https://zakupy.auchan.pl/produkty/warzywa-i-owoce

    # Wyświetl użytkowników z bazy
    python catalog_scraper.py --list-users

UWAGA: Adresy kategorii mogą się zmienić ze strony sklepu.
Jeśli dana kategoria nie zwraca produktów, użyj --inspect żeby sprawdzić
czy URL jest poprawny i jakie odpowiedzi API przechwytuje scraper.
"""

import asyncio
import json
import re
import sys
import argparse
import time
import urllib.request
import urllib.parse
from pathlib import Path
from typing import Optional

import psycopg2

try:
    from playwright.async_api import async_playwright, Page
except ImportError:
    print("Brak playwright: pip install playwright && playwright install chromium")
    sys.exit(1)


# ─── Config ────────────────────────────────────────────────────────────────────

DB_CONFIG = {
    "host":     "localhost",
    "port":     5432,
    "dbname":   "mealplanner",
    "user":     "user",
    "password": "password",
}
DEFAULT_USER_ID = 2
OUTPUT_FILE = Path(__file__).parent / "catalog_products.json"
UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
MAX_PAGES = 20          # max kliknięć "załaduj więcej" na kategorię
PAGE_DELAY_MS = 1500    # pauza między stronami (ms)


# ─── Kategorie spożywcze (bez alkoholi, chemii, itp.) ─────────────────────────
#
# URL-e kategorii mogą się zmienić — jeśli nie działa, sprawdź ręcznie na stronie
# i zaktualizuj odpowiedni wpis poniżej.

# URL format Auchan: zakupy.auchan.pl/categories/{slug}/{id}
# Warzywa, mięso, nabiał, ryby, pieczywo, mrożonki itd. są podkategoriami
# "Artykuły spożywcze" (2091) — scraper przejdzie przez cały drzewko.
AUCHAN_CATS = [
    ("Artykuły spożywcze",   "https://zakupy.auchan.pl/categories/artyku%C5%82y-spo%C5%BCywcze/2091?source=navigation"),
    ("Zdrowa żywność",       "https://zakupy.auchan.pl/categories/zdrowa-%C5%BCywno%C5%9B%C4%87/3177?source=navigation"),
    ("Kawa, Herbata i kakao","https://zakupy.auchan.pl/categories/kawa-herbata-i-kakao/4324?source=navigation"),
    ("Karmienie niemowląt",  "https://zakupy.auchan.pl/categories/dziecko-i-mama/4355?source=navigation"),
    # Wykluczone: Alkohole (3639), Chemia (3691), Higiena (3842),
    #             Dla zwierząt (6086), Biurowe (2924), Dom (4131), Auto-Moto (4057)
]

BIEDRONKA_CATS = [
    # URL format: zakupy.biedronka.pl/{slug}/  (z trailing slash)
    ("Warzywa",              "https://zakupy.biedronka.pl/warzywa/"),
    ("Owoce",                "https://zakupy.biedronka.pl/owoce/"),
    ("Piekarnia",            "https://zakupy.biedronka.pl/piekarnia/"),
    ("Nabiał",               "https://zakupy.biedronka.pl/nabial/"),
    ("Mięso",                "https://zakupy.biedronka.pl/mieso/"),
    ("Dania gotowe",         "https://zakupy.biedronka.pl/dania-gotowe/"),
    ("Napoje",               "https://zakupy.biedronka.pl/napoje/"),
    ("Mrożone",              "https://zakupy.biedronka.pl/mrozone/"),
    ("Art. spożywcze",       "https://zakupy.biedronka.pl/artykuly-spozywcze/"),
    ("Karmienie niemowląt",  "https://zakupy.biedronka.pl/dla-dzieci/karmienie/"),
    # Wykluczone: Polecane, Drogeria, Dla domu, Dla zwierząt
]

CARREFOUR_CATS = [
    # URL format: carrefour.pl/{slug}  (bez /c/)
    ("Owoce, warzywa, zioła",    "https://www.carrefour.pl/owoce-warzywa-ziola"),
    ("Mięso",                    "https://www.carrefour.pl/mieso"),
    ("Wędliny i kiełbasy",       "https://www.carrefour.pl/wedliny-kielbasy"),
    ("Ryby i owoce morza",       "https://www.carrefour.pl/ryby-i-owoce-morza"),
    ("Mleko, nabiał, jaja",      "https://www.carrefour.pl/mleko-nabial-jaja"),
    ("Piekarnia, ciastkarnia",   "https://www.carrefour.pl/piekarnia-ciastkarnia"),
    ("Artykuły spożywcze",       "https://www.carrefour.pl/artykuly-spozywcze"),
    ("Zdrowa żywność",           "https://www.carrefour.pl/zdrowa-zywnosc"),
    ("Napoje",                   "https://www.carrefour.pl/napoje"),
    ("Mrożonki",                 "https://www.carrefour.pl/mrozonki"),
    ("Dania gotowe",             "https://www.carrefour.pl/dania-gotowe-i-przystawki"),
    ("Karmienie niemowląt",      "https://www.carrefour.pl/dziecko/karmienie"),
    # Wykluczone: Drogeria, Dla zwierząt, Zakupy niecodzienne
]

STORE_MAP = {
    "auchan":    ("Auchan",    AUCHAN_CATS),
    "biedronka": ("Biedronka", BIEDRONKA_CATS),
    "carrefour": ("Carrefour", CARREFOUR_CATS),
}


# ─── Filtr produktów nieżywnościowych ─────────────────────────────────────────
# Odrzuca produkty których nazwa pasuje do wzorców — chroni przed wpadkami
# w szerokich kategoriach (Dziecko i Mama, Artykuły spożywcze, itp.)

NON_FOOD_RE = re.compile(
    r"\b("
    # higiena niemowląt
    r"szczoteczk[ai]|pasta do zębów|chusteczki nawilżan|mokre chusteczki|"
    r"pieluchy|pieluszk[ai]|majteczki jednorazow|podkład higieniczny|"
    r"smoczek|smoczk[ai]|gryzak|butelk[ai] do karmienia|sterylizator|"
    r"balsam do ciała|krem natłuszczający|krem ochronny|oliwka do ciała|"
    # ubrania / tekstylia
    r"śpioch|pajacyk|kombinezon|body niemowlęce|śpioszk|rampersy|"
    r"rękawiczki|skarpetki|czapk[ai]|kapelusik|buciki|spodenki|bluzeczk|"
    # sprzęt / akcesoria
    r"wózek|nosidełko|fotelik|łóżeczko|wanienka|nocnik|laktator|"
    r"termometr|monitor oddechu|zabawk[ai]|grzechotk[ai]|"
    # higiena ogólna
    r"żel pod prysznic|szampon|odżywka do włosów|płyn do kąpieli|"
    r"podpask[ai]|tampon|wkładki higieniczne"
    r")\b",
    re.IGNORECASE | re.UNICODE,
)


def is_food_product(name: str) -> bool:
    """True jeśli nazwa produktu NIE pasuje do wzorców nieżywnościowych."""
    return not NON_FOOD_RE.search(name)


# ─── Parsowanie wagi/jednostki z nazwy produktu ────────────────────────────────

BY_WEIGHT_KW = [
    "na wagę", "na wag", "luzem", "kg szac", "(dostawa", "ok. 1 kg", "świeże (",
    "sprzedawany na wagę", "cena za kg", "cena/kg",
]

# Pola API które wskazują na sprzedaż na wagę
SBW_API_FIELDS   = ("soldByWeight", "sold_by_weight", "isByWeight", "byWeight",
                    "weightBased", "isWeightProduct", "weightItem")
SBW_UNIT_VALUES  = {"kg", "kilogram", "kilo"}   # wartości pola priceUnit / unitOfMeasure

WEIGHT_PATTERNS = [
    (re.compile(r"(\d+(?:[.,]\d+)?)\s*kg\b",         re.I), "kg"),
    (re.compile(r"(\d+(?:[.,]\d+)?)\s*dag\b",        re.I), "dag"),
    (re.compile(r"(\d+(?:[.,]\d+)?)\s*g\b",          re.I), "g"),
    (re.compile(r"(\d+(?:[.,]\d+)?)\s*l\b(?![a-z])", re.I), "l"),
    (re.compile(r"(\d+(?:[.,]\d+)?)\s*ml\b",         re.I), "ml"),
    (re.compile(r"(\d+)\s*szt\.?\b",                 re.I), "szt"),
]


def parse_weight(name: str) -> dict:
    """Wyciąga gramaturę/objętość/szt z nazwy produktu."""
    low = name.lower()
    if any(k in low for k in BY_WEIGHT_KW):
        return {"package_weight": 1000.0, "unit": "g", "sold_by_weight": True}
    for rgx, raw in WEIGHT_PATTERNS:
        m = rgx.search(name)
        if not m:
            continue
        v = float(m.group(1).replace(",", "."))
        if raw == "kg":  return {"package_weight": round(v * 1000), "unit": "g",  "sold_by_weight": False}
        if raw == "dag": return {"package_weight": round(v * 10),   "unit": "g",  "sold_by_weight": False}
        if raw == "l":   return {"package_weight": round(v * 1000), "unit": "ml", "sold_by_weight": False}
        return {"package_weight": round(v), "unit": raw, "sold_by_weight": False}
    return {"package_weight": 100, "unit": "g", "sold_by_weight": False}


def _norm_unit(val: float, raw_unit: str) -> dict:
    """Normalizuje jednostkę ze struktury API do formatu bazy."""
    ru = raw_unit.lower().strip()
    if "kg" in ru:   return {"package_weight": round(val * 1000), "unit": "g",   "sold_by_weight": False}
    if "dag" in ru:  return {"package_weight": round(val * 10),   "unit": "g",   "sold_by_weight": False}
    if ru in ("l", "litr", "liter", "litre"):
                     return {"package_weight": round(val * 1000), "unit": "ml",  "sold_by_weight": False}
    if "ml" in ru:   return {"package_weight": round(val),        "unit": "ml",  "sold_by_weight": False}
    if ru in ("szt", "pcs", "piece", "sztuka", "op", "opak"):
                     return {"package_weight": max(1, round(val)), "unit": "szt", "sold_by_weight": False}
    return           {"package_weight": round(val),               "unit": "g",   "sold_by_weight": False}


def to_db_price(pkg_price: float, weight: dict) -> float:
    """Przelicza cenę opakowania → cenę per 100g / 100ml / szt (format bazy)."""
    pw   = max(float(weight["package_weight"]), 0.001)
    unit = weight["unit"]
    if weight["sold_by_weight"]:
        return pkg_price / 10       # zł/kg → zł/100g
    if unit == "szt":
        return pkg_price / pw       # cena opak → cena/szt
    return pkg_price / pw * 100     # cena opak → zł/100g lub zł/100ml


# ─── Wyciąganie produktów z JSON (API interception) ───────────────────────────

# Klucze pod którymi sklepy chowają listy produktów
PRODUCT_LIST_KEYS = {
    "products", "items", "results", "searchResults", "resultsList",
    "productsList", "entries", "data", "hits", "documents",
    "productList", "Products", "Items", "catalogue", "records",
}
# Klucze z nazwą produktu
NAME_KEYS = ("displayName", "name", "title", "productName", "label", "fullName", "shortName")
# Klucze z ceną wewnątrz obiektu price{}
INNER_PRICE_KEYS = ("value", "amount", "regularPrice", "priceValue", "gross", "salesPrice", "sellPrice")
# Klucze z ceną na poziomie produktu
TOP_PRICE_KEYS = ("regularPrice", "salePrice", "offerPrice", "finalPrice", "priceValue",
                  "price_value", "listPrice", "basePrice")


def _try_extract(item: dict) -> Optional[dict]:
    """Próbuje wyciągnąć dane produktu z pojedynczego elementu JSON."""
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

    # Cena
    price = None
    raw_p = item.get("price")
    if isinstance(raw_p, (int, float)) and raw_p > 0:
        price = float(raw_p)
    elif isinstance(raw_p, dict):
        price = next(
            (float(raw_p[k]) for k in INNER_PRICE_KEYS
             if k in raw_p and isinstance(raw_p[k], (int, float)) and raw_p[k] > 0),
            None,
        )
    if price is None:
        price = next(
            (float(item[k]) for k in TOP_PRICE_KEYS
             if k in item and isinstance(item[k], (int, float)) and item[k] > 0),
            None,
        )
    # Biedronka: cena split integer + decimal
    if price is None and "priceInteger" in item:
        try:
            price = float(str(item["priceInteger"]) + "." + str(item.get("priceDecimal", "00")).zfill(2))
        except Exception:
            pass

    if not price or price <= 0 or price > 5000:
        return None

    # Waga ze struktury API (jeśli dostępna)
    weight = None
    for wk, uk in (("netContent", "netContentUnit"), ("grammage", "grammageUnit"),
                   ("weightValue", "weightUnit"), ("packageSize", "packageUnit"),
                   ("contentSize", "contentUnit")):
        if wk in item:
            wval = item[wk]
            if isinstance(wval, (int, float)) and wval > 0:
                raw_unit = str(item.get(uk, "g") or "g").strip()
                weight = _norm_unit(float(wval), raw_unit)
                break

    # Wykrywanie sold_by_weight z pól API (zanim parse_weight z nazwy)
    api_sbw = any(item.get(f) for f in SBW_API_FIELDS)
    if not api_sbw:
        for k in ("priceUnit", "unitOfMeasure", "pricingUnit", "sellUnit", "priceType"):
            if str(item.get(k, "")).lower().strip() in SBW_UNIT_VALUES:
                api_sbw = True
                break

    if weight is None:
        weight = parse_weight(name)

    if api_sbw:
        weight = {"package_weight": 1000.0, "unit": "g", "sold_by_weight": True}

    return {"name": name[:150], "package_price": price, **weight}


def _search_json(data, depth: int = 0) -> list[dict]:
    """Rekurencyjnie przeszukuje JSON w poszukiwaniu list produktów."""
    if depth > 9:
        return []
    found = []
    if isinstance(data, list):
        for item in data:
            p = _try_extract(item)
            if p:
                found.append(p)
            elif isinstance(item, (dict, list)):
                found.extend(_search_json(item, depth + 1))
    elif isinstance(data, dict):
        for key, val in data.items():
            if key in PRODUCT_LIST_KEYS and isinstance(val, (list, dict)):
                # Priorytet dla kluczy które wprost wskazują na produkty
                sub = _search_json(val, depth)
                if sub:
                    found.extend(sub)
                    continue
            if isinstance(val, (dict, list)):
                found.extend(_search_json(val, depth + 1))
    return found


# ─── Fallback: parsowanie DOM gdy API nic nie zwróciło ────────────────────────

DOM_EXTRACT_JS = """() => {
    // Próbuje znaleźć karty produktów na stronie
    const SELECTORS = [
        '[data-testid*="product-card"]',
        '[class*="ProductCard"]', '[class*="product-card"]', '[class*="product_card"]',
        '[class*="ProductTile"]', '[class*="product-tile"]', '[class*="product_tile"]',
        '[class*="ProductItem"]', '[class*="product-item"]', '[class*="product_item"]',
        'article[class*="product"]', 'li[class*="product"]',
    ];
    let cards = [];
    for (const sel of SELECTORS) {
        const els = [...document.querySelectorAll(sel)];
        if (els.length > 2) { cards = els; break; }
    }

    const priceRe = /(\\d+)[,.]?(\\d{2})\\s*z/;
    const results = [];
    for (const card of cards) {
        const nameEl = card.querySelector(
            '[class*="name" i], [class*="title" i], [data-testid*="name" i], h2, h3, h4'
        );
        const priceEl = card.querySelector(
            '[class*="price" i]:not([class*="per" i]):not([class*="unit" i]), [data-testid*="price" i]'
        );
        if (!nameEl || !priceEl) continue;
        const name = nameEl.innerText.trim();
        if (!name || name.length < 3) continue;
        const pm = priceEl.innerText.match(priceRe);
        if (!pm) continue;
        const price = parseFloat(pm[1] + '.' + pm[2]);
        if (price <= 0 || price > 5000) continue;
        results.push({ name, package_price: price });
    }
    return results;
}"""


# ─── Paginacja ─────────────────────────────────────────────────────────────────

LOAD_MORE_SELECTORS = [
    "button[class*='LoadMore' i]",
    "button[class*='load-more' i]",
    "button[class*='show-more' i]",
    "button[class*='pokaż-więcej' i]",
    "button[class*='zaladuj' i]",
    "[data-testid*='load-more' i]",
    "[data-testid*='next-page' i]",
    "a[aria-label*='Następna' i]",
    "a[aria-label*='next' i]",
    "button[aria-label*='next' i]",
]


async def try_load_more(page: Page) -> bool:
    """Kliknie 'załaduj więcej' / 'następna strona' jeśli jest widoczny. Zwraca True jeśli kliknął."""
    for sel in LOAD_MORE_SELECTORS:
        try:
            btn = await page.query_selector(sel)
            if btn and await btn.is_visible():
                await btn.scroll_into_view_if_needed()
                await btn.click()
                await page.wait_for_timeout(PAGE_DELAY_MS)
                return True
        except Exception:
            pass
    return False


async def scroll_down(page: Page, steps: int = 4):
    """Przewija stronę w dół (trigger infinite scroll)."""
    for _ in range(steps):
        await page.evaluate("window.scrollBy(0, window.innerHeight * 1.5)")
        await page.wait_for_timeout(600)


# ─── Scraping kategorii ────────────────────────────────────────────────────────

# Domeny które warto ignorować przy intercepcji (analytics, tracking)
SKIP_DOMAINS = (
    "analytics", "tracking", "gtm.", "google-analytics", "facebook.net",
    "segment.io", "hotjar", "newrelic", "sentry", "datadog", "amplitude",
)


async def scrape_category(
    page: Page, cat_name: str, cat_url: str, store: str, limit: int = 0
) -> list[dict]:
    """Scrape'uje jedną kategorię. Zwraca listę produktów."""
    intercepted: list[dict] = []

    async def on_response(resp):
        if "json" not in resp.headers.get("content-type", ""):
            return
        if any(d in resp.url for d in SKIP_DOMAINS):
            return
        try:
            body = await resp.json()
            found = _search_json(body)
            if found:
                intercepted.extend(found)
        except Exception:
            pass

    page.on("response", on_response)
    print(f"  [{store}] {cat_name:<30}", end="", flush=True)

    try:
        await page.goto(cat_url, wait_until="load", timeout=40000)
    except Exception:
        try:
            await page.goto(cat_url, wait_until="domcontentloaded", timeout=30000)
        except Exception as e:
            print(f" ❌ błąd ładowania: {e}")
            page.remove_listener("response", on_response)
            return []

    await page.wait_for_timeout(2000)
    await scroll_down(page)

    # Paginacja
    prev_count = -1
    for pg_num in range(MAX_PAGES):
        if limit and len(intercepted) >= limit:
            break
        cur_count = len(intercepted)
        if cur_count == prev_count and pg_num > 1:
            break   # brak nowych produktów
        prev_count = cur_count

        clicked = await try_load_more(page)
        if not clicked:
            await scroll_down(page, steps=3)
            await page.wait_for_timeout(PAGE_DELAY_MS)

    # Deduplikacja + normalizacja
    seen: set[str] = set()
    products: list[dict] = []

    source = intercepted
    if not source:
        # DOM fallback
        try:
            dom_res = await page.evaluate(DOM_EXTRACT_JS)
            source = dom_res or []
            if source:
                print(" [DOM]", end="", flush=True)
        except Exception:
            source = []

    for raw in source:
        name = (raw.get("name") or "").strip()
        if not name or name.lower() in seen:
            continue
        if not is_food_product(name):
            continue
        seen.add(name.lower())

        # Upewnij się że mamy wagę
        if not raw.get("package_weight"):
            raw.update(parse_weight(name))

        pkg_price = float(raw.get("package_price", 0))
        if pkg_price <= 0:
            continue

        entry = {
            "name":           name[:150],
            "package_price":  round(pkg_price, 2),
            "package_weight": max(float(raw.get("package_weight", 100)), 0.1),
            "unit":           raw.get("unit", "g"),
            "sold_by_weight": bool(raw.get("sold_by_weight", False)),
            "category":       cat_name,
            "store":          store,
        }
        entry["db_price"] = round(to_db_price(pkg_price, entry), 4)
        products.append(entry)

        if limit and len(products) >= limit:
            break

    page.remove_listener("response", on_response)
    print(f" → {len(products)} produktów")
    return products


# ─── Scraping sklepu ───────────────────────────────────────────────────────────

async def scrape_store(store_key: str, cats: list, limit: int = 0) -> list[dict]:
    all_products: list[dict] = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(
            user_agent=UA,
            viewport={"width": 1440, "height": 900},
            locale="pl-PL",
        )
        # Akceptacja cookies — spróbuj kliknąć typowe przyciski
        page = await ctx.new_page()
        try:
            first_url = cats[0][1]
            await page.goto(first_url, wait_until="load", timeout=30000)
            await page.wait_for_timeout(2000)
            for cookie_sel in (
                "button#onetrust-accept-btn-handler",
                "button[id*='accept' i][id*='cookie' i]",
                "button[class*='accept' i][class*='cookie' i]",
                "button[data-testid*='cookie' i]",
                "[aria-label*='Akceptuj' i]",
                "[aria-label*='Accept' i]",
            ):
                try:
                    btn = await page.query_selector(cookie_sel)
                    if btn and await btn.is_visible():
                        await btn.click()
                        await page.wait_for_timeout(1000)
                        break
                except Exception:
                    pass
        except Exception:
            pass

        for cat_name, cat_url in cats:
            try:
                products = await scrape_category(page, cat_name, cat_url, store_key, limit)
                all_products.extend(products)
                await page.wait_for_timeout(800)
            except Exception as e:
                print(f"  ❌ {cat_name}: {e}")

        await browser.close()
    return all_products


# ─── Open Food Facts — pobieranie makr ────────────────────────────────────────

def fetch_macro_off(name: str) -> Optional[dict]:
    """
    Szuka produktu w Open Food Facts i zwraca {kcal, protein, fat, carbs}/100g.
    Taki sam algorytm jak w aplikacji React (fetchMacroFromOFF).
    """
    try:
        q   = urllib.parse.quote(name)
        url = (
            "https://world.openfoodfacts.org/cgi/search.pl"
            f"?search_terms={q}&search_simple=1&action=process"
            "&json=1&page_size=5&fields=product_name,nutriments"
        )
        req = urllib.request.Request(url, headers={"User-Agent": "mealprep-catalog/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
        for p in data.get("products", []):
            n    = p.get("nutriments", {})
            kcal = n.get("energy-kcal_100g") or n.get("energy-kcal")
            if not kcal and n.get("energy_100g"):
                kcal = round(n["energy_100g"] / 4.184 * 10) / 10
            if kcal:
                return {
                    "kcal":    round(float(kcal) * 10) / 10,
                    "protein": round(float(n.get("proteins_100g")      or 0) * 10) / 10,
                    "fat":     round(float(n.get("fat_100g")           or 0) * 10) / 10,
                    "carbs":   round(float(n.get("carbohydrates_100g") or 0) * 10) / 10,
                }
    except Exception:
        pass
    return None


# ─── Import do bazy ────────────────────────────────────────────────────────────

def import_to_db(products: list[dict], user_id: int, dry_run: bool,
                 fetch_macro: bool = True) -> dict:
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    cur.execute("SELECT LOWER(name) FROM products WHERE user_id = %s", (user_id,))
    existing = {r[0] for r in cur.fetchall()}
    print(f"  Istniejące produkty w bazie: {len(existing)}")

    added = skipped = errors = macro_ok = 0
    total = len(products)
    for idx, p in enumerate(products, 1):
        name = (p.get("name") or "").strip()
        if not name or len(name) < 2:
            continue
        if name.lower() in existing:
            skipped += 1
            continue

        pw       = min(max(float(p.get("package_weight", 100)), 0.1), 99999)
        db_price = min(max(float(p.get("db_price", 0)), 0), 99999)
        unit     = p.get("unit", "g")
        sbw      = bool(p.get("sold_by_weight", False))

        if dry_run:
            sbw_label = " [na wagę]" if sbw else ""
            print(f"  [DRY] {name[:55]:<57} | {int(pw):>5}{unit:<3} | {db_price:.4f} zł{sbw_label}")
            existing.add(name.lower())
            added += 1
            continue

        try:
            cur.execute(
                "INSERT INTO products (user_id, name, price, package_weight, unit, sold_by_weight) "
                "VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
                (user_id, name[:200], db_price, pw, unit, sbw),
            )
            product_id = cur.fetchone()[0]
            conn.commit()
            existing.add(name.lower())
            added += 1
        except Exception as e:
            conn.rollback()
            errors += 1
            print(f"  ❌ DB error [{name[:40]}]: {e}")
            continue

        # Pobierz makra z Open Food Facts
        if fetch_macro:
            macro = fetch_macro_off(name)
            if macro:
                try:
                    cur.execute(
                        "UPDATE products SET kcal=%s, protein=%s, fat=%s, carbs=%s WHERE id=%s",
                        (macro["kcal"], macro["protein"], macro["fat"], macro["carbs"], product_id),
                    )
                    conn.commit()
                    macro_ok += 1
                except Exception:
                    conn.rollback()
            time.sleep(0.25)   # rate limiting — max ~4 req/s do OFF

        # Progres co 10 produktów
        if idx % 10 == 0 or idx == total:
            print(f"  [{idx}/{total}] dodano={added} makro={macro_ok} błędy={errors}", end="\r")

    print()  # newline po \r
    conn.close()
    return {"added": added, "skipped": skipped, "errors": errors, "macro_ok": macro_ok}


# ─── Tryb inspect (debugowanie) ────────────────────────────────────────────────

async def inspect_category(url: str):
    """Otwiera przeglądarkę, przechwytuje API, drukuje co znalazł."""
    print(f"\nInspect: {url}\n{'='*70}")
    api_hits: list[dict] = []

    async with async_playwright() as pw:
        # headless=False — widoczna przeglądarka żebyś widział co się dzieje
        browser = await pw.chromium.launch(headless=False)
        ctx = await browser.new_context(user_agent=UA, locale="pl-PL")
        page = await ctx.new_page()

        async def on_resp(r):
            if "json" not in r.headers.get("content-type", ""):
                return
            if any(d in r.url for d in SKIP_DOMAINS):
                return
            try:
                body = await r.json()
                found = _search_json(body)
                if found:
                    api_hits.append({"url": r.url, "count": len(found), "sample": found[:2]})
            except Exception:
                pass

        page.on("response", on_resp)
        try:
            await page.goto(url, wait_until="load", timeout=40000)
        except Exception:
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(4000)
        await scroll_down(page, steps=6)
        await page.wait_for_timeout(2000)

        print(f"\n── API responses z produktami: {len(api_hits)} ──")
        for h in api_hits[:15]:
            print(f"\n  URL:   {h['url'][:90]}")
            print(f"  Znaleziono: {h['count']} produktów. Przykłady:")
            for p in h["sample"]:
                print(f"    → {p.get('name', '?')[:60]:<62} | {p.get('package_price', '?')} zł")

        dom_res = await page.evaluate(DOM_EXTRACT_JS)
        dom_res = dom_res or []
        print(f"\n── DOM fallback: {len(dom_res)} produktów ──")
        for p in dom_res[:5]:
            print(f"  → {p.get('name', '?')[:60]:<62} | {p.get('package_price', '?')} zł")

        input("\nNaciśnij Enter żeby zamknąć przeglądarkę...")
        await browser.close()


# ─── Discover — wyciąga linki kategorii ze strony ─────────────────────────────

DISCOVER_URLS = {
    "auchan":    "https://zakupy.auchan.pl",
    "biedronka": "https://zakupy.biedronka.pl",
    "carrefour": "https://www.carrefour.pl",
}

# Słowa-klucze kategorii do wykluczenia (chemia, alkohole, itd.)
EXCLUDE_KEYWORDS = [
    "alkohole", "alkohol", "chemia", "środki czystości", "czystości",
    "higiena", "kosmetyki", "zwierząt", "zwierzęta", "biurowe", "szkolne",
    "dla domu", "artykuły do domu", "auto-moto", "automoto",
    "drogeria", "zdrowie", "apteka",
]
# Słowa-klucze które MUSZĄ być w nazwie żeby zakwalifikować się jako spożywcze
FOOD_KEYWORDS = [
    "warzywa", "owoce", "zioła", "mięso", "wędlin", "kiełbas", "ryby", "owoce morza",
    "nabiał", "mleko", "jaja", "jaj", "pieczywo", "piekarnia", "ciastkarnia",
    "spożywcze", "makarony", "kasze", "ryż", "konserwy", "przetwory",
    "sosy", "przyprawy", "oleje", "tłuszcze", "słodycze", "przekąski",
    "kawa", "herbata", "kakao", "napoje", "mrożonki", "mrożone", "dania gotowe",
    "dania", "przekąski", "zdrowa żywność", "żywność", "bio", "vege",
    "karmienie", "niemowlęta", "dziecko i mama",
]


async def discover_categories(store: str):
    """Otwiera stronę główną sklepu i wyciąga linki kategorii z nawigacji."""
    base_url = DISCOVER_URLS.get(store)
    if not base_url:
        print(f"Nieznany sklep: {store}")
        return

    print(f"\nDiscover kategorie: {store} ({base_url})")
    print("Otwieram widoczną przeglądarkę — poczekaj aż strona się załaduje...\n")

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False)
        ctx = await browser.new_context(user_agent=UA, locale="pl-PL",
                                        viewport={"width": 1440, "height": 900})
        page = await ctx.new_page()
        await page.goto(base_url, wait_until="load", timeout=40000)
        await page.wait_for_timeout(3000)

        # Próbuj otworzyć menu kategorii (klik w "Kategorie" lub podobny przycisk)
        for sel in ("[data-testid*='categor' i]", "button[aria-label*='Kategorie' i]",
                    "a[href*='kategori' i]", "[class*='categor' i] button",
                    "nav button", ".menu-toggle"):
            try:
                el = await page.query_selector(sel)
                if el and await el.is_visible():
                    await el.click()
                    await page.wait_for_timeout(1500)
                    break
            except Exception:
                pass

        # Wyciągnij wszystkie linki z nawigacji
        links = await page.evaluate("""() => {
            const seen = new Set();
            const results = [];
            // Szukaj linków w nawigacji / menu
            const els = document.querySelectorAll('nav a[href], [class*="menu" i] a[href], [class*="nav" i] a[href], [class*="categor" i] a[href]');
            for (const el of els) {
                const href = el.href || '';
                const text = (el.innerText || el.textContent || '').trim().replace(/\\s+/g, ' ');
                if (!href || !text || text.length < 2 || seen.has(href)) continue;
                seen.add(href);
                results.push({ text, href });
            }
            return results;
        }""")

        if not links:
            # Fallback: wszystkie linki na stronie
            links = await page.evaluate("""() => {
                const seen = new Set();
                return [...document.querySelectorAll('a[href]')]
                    .map(a => ({ text: a.innerText.trim(), href: a.href }))
                    .filter(x => x.text && x.href && !seen.has(x.href) && seen.add(x.href));
            }""")

        await browser.close()

    print(f"Znaleziono {len(links)} linków. Filtruję kategorię spożywcze...\n")

    food = []
    excluded = []
    other = []
    for lnk in links:
        text_low = lnk["text"].lower()
        href = lnk["href"]
        # Odfiltruj linki nie będące kategoriami (produkty, konto, koszyk, itp.)
        if not any(x in href for x in ("categor", "kategori", "/c/", "/warzywa", "/owoce",
                                        "/mieso", "/nabial", "/piekarnia", "/mrozon",
                                        "/napoje", "/dania", "/spozywcze", "/zdrowa")):
            continue
        if any(kw in text_low for kw in EXCLUDE_KEYWORDS):
            excluded.append(lnk)
        elif any(kw in text_low for kw in FOOD_KEYWORDS):
            food.append(lnk)
        else:
            other.append(lnk)

    print("── SPOŻYWCZE (rekomendowane do scrapowania) ──")
    for i, lnk in enumerate(food):
        print(f"  {i+1:>2}. {lnk['text']:<40}  {lnk['href']}")

    if other:
        print("\n── INNE (sprawdź ręcznie) ──")
        for lnk in other[:20]:
            print(f"      {lnk['text']:<40}  {lnk['href']}")

    if excluded:
        print(f"\n── WYKLUCZONE ({len(excluded)}) ──")
        for lnk in excluded[:10]:
            print(f"      {lnk['text']:<40}  {lnk['href']}")

    print(f"""
Skopiuj URL-e kategorii spożywczych i wklej do AUCHAN_CATS / BIEDRONKA_CATS / CARREFOUR_CATS
w pliku catalog_scraper.py, np.:
    ("{food[0]['text'] if food else 'Warzywa'}", "{food[0]['href'] if food else 'https://...'}"),
""")


# ─── Pomocnicze ────────────────────────────────────────────────────────────────

def list_users():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    cur.execute("""
        SELECT u.id, u.email, COUNT(p.id)
        FROM users u LEFT JOIN products p ON p.user_id = u.id
        GROUP BY u.id, u.email ORDER BY u.id
    """)
    rows = cur.fetchall()
    conn.close()
    print(f"\n{'ID':>4}  {'Produktów':>10}  Email")
    print("-" * 50)
    for uid, email, cnt in rows:
        marker = " ← DEFAULT" if uid == DEFAULT_USER_ID else ""
        print(f"{uid:>4}  {cnt:>10}  {email}{marker}")


# ─── Main ──────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(
        description="Catalog scraper — produkty spożywcze",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Przykłady:
  python catalog_scraper.py --scrape auchan --dry-run --limit 10
  python catalog_scraper.py --scrape all
  python catalog_scraper.py --import catalog_products.json
  python catalog_scraper.py --inspect https://zakupy.auchan.pl/produkty/warzywa-i-owoce
        """,
    )
    ap.add_argument("--scrape",     metavar="SKLEP",  help="auchan | biedronka | carrefour | all")
    ap.add_argument("--import",     metavar="PLIK",   dest="import_file", help="Importuj z JSON do bazy")
    ap.add_argument("--inspect",    metavar="URL",    help="Debuguj kategorię (widoczna przeglądarka)")
    ap.add_argument("--limit",      type=int, default=0, help="Max produktów na kategorię (0=bez limitu)")
    ap.add_argument("--dry-run",    action="store_true", help="Nie zapisuj do bazy, tylko pokaż co by dodało")
    ap.add_argument("--output",     default=str(OUTPUT_FILE), help=f"Plik wyjściowy (domyślnie: {OUTPUT_FILE.name})")
    ap.add_argument("--user-id",    type=int, default=DEFAULT_USER_ID, help=f"user_id w bazie (domyślnie: {DEFAULT_USER_ID})")
    ap.add_argument("--no-macro",   action="store_true", help="Pomiń pobieranie makr z Open Food Facts (szybszy import)")
    ap.add_argument("--discover",   metavar="SKLEP",  help="Wyciągnij linki kategorii ze strony (auchan|biedronka|carrefour)")
    ap.add_argument("--list-users", action="store_true", help="Wyświetl użytkowników z bazy")
    args = ap.parse_args()

    if args.discover:
        asyncio.run(discover_categories(args.discover))
        return

    if args.list_users:
        list_users()
        return

    if args.inspect:
        asyncio.run(inspect_category(args.inspect))
        return

    if args.import_file:
        path = Path(args.import_file)
        if not path.exists():
            print(f"Plik nie istnieje: {path}")
            sys.exit(1)
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        # Obsługuje oba formaty: lista lub {"auchan": [...], "biedronka": [...]}
        products = data if isinstance(data, list) else [p for lst in data.values() for p in lst]
        print(f"Importuję {len(products)} produktów z {path.name} (user_id={args.user_id})...")
        if args.dry_run:
            print("[DRY RUN — podgląd, żadne zmiany nie zostaną zapisane]\n")
        r = import_to_db(products, args.user_id, dry_run=args.dry_run,
                         fetch_macro=not args.no_macro)
        print(f"\nDodano: {r['added']} | Makro: {r.get('macro_ok',0)} | Pominięto: {r['skipped']} | Błędy: {r['errors']}")
        return

    if not args.scrape:
        ap.print_help()
        return

    # Wybierz sklepy do scrapowania
    if args.scrape == "all":
        to_scrape = list(STORE_MAP.items())
    elif args.scrape in STORE_MAP:
        to_scrape = [(args.scrape, STORE_MAP[args.scrape])]
    else:
        print(f"Nieznany sklep: '{args.scrape}'. Dostępne: auchan, biedronka, carrefour, all")
        sys.exit(1)

    all_results: dict[str, list[dict]] = {}
    total = 0

    for store_key, (store_label, cats) in to_scrape:
        print(f"\n{'='*70}")
        print(f"  {store_label} — {len(cats)} kategorii spożywczych")
        print(f"{'='*70}")
        products = asyncio.run(scrape_store(store_key, cats, args.limit))
        all_results[store_key] = products
        total += len(products)
        print(f"  ✓ {store_label}: {len(products)} produktów łącznie")

    if not total:
        print("\nNie znaleziono żadnych produktów. Sprawdź URL-e kategorii --inspect.")
        return

    # Zapisz do JSON
    output_path = Path(args.output)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)
    print(f"\n{'='*70}")
    print(f"Zapisano {total} produktów → {output_path}")

    # Importuj do bazy (chyba że dry-run)
    if args.dry_run:
        print("\n[DRY RUN — podgląd importu, żadne zmiany nie zostaną zapisane]\n")
        flat = [p for lst in all_results.values() for p in lst]
        import_to_db(flat, args.user_id, dry_run=True, fetch_macro=False)
    else:
        fetch = not args.no_macro
        print(f"\nImportuję do bazy (user_id={args.user_id}, makro={'TAK' if fetch else 'NIE'})...")
        flat = [p for lst in all_results.values() for p in lst]
        r = import_to_db(flat, args.user_id, dry_run=False, fetch_macro=fetch)
        print(f"Dodano: {r['added']} | Makro: {r.get('macro_ok',0)} | Pominięto: {r['skipped']} | Błędy: {r['errors']}")
        print(f"\nGotowe! Produkty dostępne w aplikacji po odświeżeniu listy produktów.")


if __name__ == "__main__":
    main()
