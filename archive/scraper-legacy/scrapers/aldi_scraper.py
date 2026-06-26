"""
Scraper produktów spożywczych z aldi.co.uk

Pobiera produkty z kategorii żywności przez Playwright (strona wymaga JS).
Dla każdego produktu: nazwa, cena, waluta, kategoria, URL, zdjęcie, opis.

Wyniki:
  data/aldi_products.json  — pełne dane produktów
  data/aldi_names.txt      — same nazwy (do ręcznej edycji)

Użycie:
    python aldi_scraper.py                  # pobierz wszystko
    python aldi_scraper.py --limit 50       # test na 50 produktach
    python aldi_scraper.py --category fresh-food   # tylko jedna kategoria
    python aldi_scraper.py --filter         # filtruj JSON według names.txt
    python aldi_scraper.py --list           # pokaż co jest zapisane
"""

import re
import sys
import json
import time
import random
import asyncio
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "pipeline"))
from food_categories import classify_product

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("Brak playwright. Zainstaluj: pip install playwright && playwright install chromium")
    sys.exit(1)

SCRAPER_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(SCRAPER_ROOT))
from data_paths import ALI_NAMES, ALI_PRODUCTS, RAW  # noqa: E402

DATA_DIR     = RAW
OUTPUT_FILE  = ALI_PRODUCTS
NAMES_FILE   = ALI_NAMES
BASE_URL     = "https://www.aldi.co.uk"

# Kategorie żywności: slug → (etykieta, URL z ID z sitemapa)
FOOD_CATEGORIES = {
    "fresh-food":              ("Fresh Food",             "https://www.aldi.co.uk/products/fresh-food/k/1588161416978050"),
    "chilled-food":            ("Chilled Food",           "https://www.aldi.co.uk/products/chilled-food/k/1588161416978051"),
    "frozen-food":             ("Frozen Food",            "https://www.aldi.co.uk/products/frozen-food/k/1588161416978056"),
    "bakery":                  ("Bakery",                 "https://www.aldi.co.uk/products/bakery/k/1588161416978049"),
    "food-cupboard":           ("Food Cupboard",          "https://www.aldi.co.uk/products/food-cupboard/k/1588161416978053"),
    "drinks":                  ("Drinks",                 "https://www.aldi.co.uk/products/drinks/k/1588161416978054"),
    "picky-bits":              ("Snacks & Party Food",    "https://www.aldi.co.uk/products/picky-bits/k/1588161431404419"),
    "vegetarian-plant-based":  ("Vegetarian & Plant-Based", "https://www.aldi.co.uk/products/vegetarian-plant-based/k/1588161421881163"),
    "higher-protein-food-drink": ("High Protein",         "https://www.aldi.co.uk/products/higher-protein-food-drink/k/1588161424510127"),
    "specially-selected":      ("Specially Selected",     "https://www.aldi.co.uk/products/specially-selected/k/1588161431580089"),
}

CONCURRENCY = 4   # równoległe strony Playwright


# ── Browser utils ─────────────────────────────────────────────────────────────

async def make_browser(playwright):
    return await playwright.chromium.launch(headless=True)


async def new_page(browser):
    ctx = await browser.new_context(
        locale="en-GB",
        extra_http_headers={"Accept-Language": "en-GB,en;q=0.9"},
    )
    return await ctx.new_page()


# ── Zbieranie URL-i produktów z kategorii ─────────────────────────────────────

async def get_product_urls_from_category(browser, cat_url: str) -> list[str]:
    """Pobiera wszystkie URL-e produktów z danej kategorii (przez wszystkie strony)."""
    page = await new_page(browser)
    all_urls: list[str] = []
    seen: set[str] = set()

    resp = await page.goto(cat_url, timeout=25000, wait_until="networkidle")
    if not resp or resp.status >= 400:
        await page.close()
        return []

    content = await page.content()

    # Max numer strony
    page_nums = re.findall(r'\?page=(\d+)', content)
    max_page   = max((int(n) for n in page_nums), default=1)

    def collect(html: str) -> int:
        new = 0
        for l in re.findall(r'href="(/product/[^"?#]+)"', html):
            full = BASE_URL + l
            if full not in seen:
                seen.add(full)
                all_urls.append(full)
                new += 1
        return new

    collect(content)

    for page_num in range(2, max_page + 1):
        try:
            await page.goto(f"{cat_url}?page={page_num}", timeout=20000, wait_until="networkidle")
            collect(await page.content())
            await asyncio.sleep(0.3 + random.uniform(0, 0.2))
        except Exception:
            pass

    await page.close()
    return all_urls


# ── Scraping pojedynczego produktu ────────────────────────────────────────────

def extract_product(content: str, url: str) -> dict | None:
    """Wyciąga dane produktu z JSON-LD na stronie."""
    jsonld_blocks = re.findall(
        r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',
        content, re.DOTALL
    )

    product_data = None
    breadcrumb   = []

    for block in jsonld_blocks:
        try:
            data = json.loads(block)
        except Exception:
            continue

        items = data if isinstance(data, list) else [data]
        for item in items:
            t = item.get("@type", "")
            if t == "Product":
                product_data = item
            elif t == "BreadcrumbList":
                breadcrumb = [
                    el.get("name", "")
                    for el in item.get("itemListElement", [])
                    if el.get("name")
                ]

    if not product_data:
        return None

    name = product_data.get("name", "").strip()
    if not name:
        return None

    # Obraz
    img = product_data.get("image", [])
    if isinstance(img, list):
        image_url = img[0] if img else ""
    elif isinstance(img, dict):
        image_url = img.get("url", "")
    else:
        image_url = str(img)

    # Cena
    offers = product_data.get("offers", {})
    price    = offers.get("price", None)
    currency = offers.get("priceCurrency", "GBP")
    try:
        price = float(price) if price is not None else None
    except (ValueError, TypeError):
        price = None

    # Cena za kg z treści strony (np. "£13.29/1 KG")
    price_per_kg = None
    per_kg_m = re.search(r'£([\d.]+)/1\s*KG', content, re.IGNORECASE)
    if per_kg_m:
        try:
            price_per_kg = float(per_kg_m.group(1))
        except ValueError:
            pass

    # Cena za litr z treści strony (np. "£4.38/1 L") — osobno bo normalize_shops tego potrzebuje
    price_per_litre = None
    per_l_m = re.search(r'£([\d.]+)/1\s*L\b', content, re.IGNORECASE)
    if per_l_m:
        try:
            price_per_litre = float(per_l_m.group(1))
        except ValueError:
            pass

    # Rozmiar opakowania z podtytułu produktu (np. "0.5 L (£4.38/1 L)", "500g (£3.00/1 KG)")
    # Ten format pojawia się jako subtitle na stronie produktu Aldi
    pack_volume     = None   # np. 500 (ml) lub 400 (g)
    pack_volume_unit = None  # "ml" lub "g"
    vol_m = re.search(
        r'(\d+(?:\.\d+)?)\s*(g|kg|ml|l|cl)\s*\(£[\d.]+/\d+\s*(?:g|kg|ml|l|cl)\)',
        content, re.IGNORECASE
    )
    if vol_m:
        try:
            val = float(vol_m.group(1))
            u   = vol_m.group(2).lower()
            if u == "kg":  val *= 1000; u = "g"
            if u == "l":   val *= 1000; u = "ml"
            if u == "cl":  val *= 10;   u = "ml"
            if val > 0:
                pack_volume      = val
                pack_volume_unit = u
        except ValueError:
            pass

    # Wielkość opakowania i cena jednostkowa (np. "4 Each (£0.46/1 Each)", "6 Pack (£0.25/1 Pack)")
    pack_size    = None
    price_per_unit = None
    pack_m = re.search(
        r'(\d+(?:\.\d+)?)\s*(Each|Pack)\s*\(£([\d.]+)/\d+\s*(?:Each|Pack)\)',
        content, re.IGNORECASE
    )
    if pack_m:
        qty  = pack_m.group(1)
        unit = pack_m.group(2).capitalize()
        pack_size = f"{qty} {unit}"
        try:
            price_per_unit = float(pack_m.group(3))
        except ValueError:
            pass

    # Kategoria z breadcrumba (pomijamy Home i Products)
    category = " > ".join(
        b for b in breadcrumb
        if b.lower() not in {"home", "products"}
    )

    description = product_data.get("description", "").strip()
    brand = (product_data.get("brand") or {}).get("name", "")

    return {
        "name":             name,
        "url":              url,
        "image_url":        image_url,
        "price":            price,
        "price_per_kg":     price_per_kg,
        "price_per_litre":  price_per_litre,
        "pack_volume":      pack_volume,
        "pack_volume_unit": pack_volume_unit,
        "pack_size":        pack_size,
        "price_per_unit":   price_per_unit,
        "currency":         currency,
        "category":         category,
        "brand":            brand,
        "description":      description,
    }


async def scrape_product(page, url: str) -> dict | None:
    try:
        resp = await page.goto(url, timeout=20000, wait_until="domcontentloaded")
        if not resp or resp.status >= 400:
            return None
        content = await page.content()
        return extract_product(content, url)
    except Exception:
        return None


# ── Zapis / odczyt ────────────────────────────────────────────────────────────

def load_existing() -> dict[str, dict]:
    if OUTPUT_FILE.exists():
        try:
            return {r["url"]: r for r in json.loads(OUTPUT_FILE.read_text("utf-8"))}
        except Exception:
            pass
    return {}


def save_products(products: dict[str, dict]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(
        json.dumps(list(products.values()), ensure_ascii=False, indent=2),
        encoding="utf-8"
    )


def save_names(products: dict[str, dict]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    lines = [f"[{r['category']}] {r['name']}" for r in products.values()]
    NAMES_FILE.write_text("\n".join(lines), encoding="utf-8")


def filter_by_names() -> None:
    if not OUTPUT_FILE.exists():
        print("Brak pliku wynikowego.")
        sys.exit(1)
    if not NAMES_FILE.exists():
        print(f"Brak {NAMES_FILE}.")
        sys.exit(1)
    keep = {
        line.strip()
        for line in NAMES_FILE.read_text("utf-8").splitlines()
        if line.strip()
    }
    products = json.loads(OUTPUT_FILE.read_text("utf-8"))
    before   = len(products)
    products = [p for p in products if f"[{p['category']}] {p['name']}" in keep]
    after    = len(products)
    OUTPUT_FILE.write_text(json.dumps(products, ensure_ascii=False, indent=2), "utf-8")
    NAMES_FILE.write_text(
        "\n".join(f"[{p['category']}] {p['name']}" for p in products), "utf-8"
    )
    print(f"Usunięto: {before - after}, zostało: {after}")


# ── Main ──────────────────────────────────────────────────────────────────────

async def run(args):
    existing = load_existing()

    async with async_playwright() as playwright:
        browser = await make_browser(playwright)

        # Wybierz kategorie
        if args.category:
            if args.category not in FOOD_CATEGORIES:
                print(f"Nieznana kategoria. Dostępne: {', '.join(FOOD_CATEGORIES)}")
                await browser.close()
                return
            categories = {args.category: FOOD_CATEGORIES[args.category]}
        else:
            categories = FOOD_CATEGORIES

        # Zbierz URL-e produktów
        print("Zbieram URL-e produktów z kategorii...")
        all_urls: list[tuple[str, str]] = []  # (url, category_label)
        seen_urls: set[str] = set()

        for slug, (label, cat_url) in categories.items():
            print(f"  [{label}]", end=" ", flush=True)
            urls = await get_product_urls_from_category(browser, cat_url)
            new  = [(u, label) for u in urls if u not in seen_urls]
            seen_urls.update(u for u, _ in new)
            all_urls.extend(new)
            print(f"→ {len(urls)} produktów (nowych: {len(new)})")
            await asyncio.sleep(0.5)

        print(f"\nŁącznie unikalnych produktów: {len(all_urls)}")

        if args.limit:
            all_urls = all_urls[:args.limit]
            print(f"Limit: {args.limit}")

        # Scraping produktów (współbieżnie)
        # Re-scrape produkty bez pola pack_size (nowe pole dodane później)
        to_scrape = [(u, c) for u, c in all_urls if u not in existing or "pack_size" not in existing[u]]
        skipped   = len(all_urls) - len(to_scrape)
        print(f"Do pobrania: {len(to_scrape)}, pominięte: {skipped}\n")

        new_count = fail_count = 0
        semaphore = asyncio.Semaphore(CONCURRENCY)

        pages = [await new_page(browser) for _ in range(CONCURRENCY)]
        page_pool = asyncio.Queue()
        for p in pages:
            await page_pool.put(p)

        async def scrape_one(url: str, cat_label: str, idx: int, total: int):
            nonlocal new_count, fail_count
            async with semaphore:
                p = await page_pool.get()
                try:
                    product = await scrape_product(p, url)
                    if product:
                        classified = classify_product(product)
                        if classified:
                            existing[url] = classified
                            new_count += 1
                            print(f"[{idx}/{total}] ✓ {classified['name'][:45]:45s} "
                                  f"[{classified['standard_category'][:20]}]")
                        else:
                            fail_count += 1
                            print(f"[{idx}/{total}] - {product['name'][:50]:50s} (poza kategorią)")
                    else:
                        fail_count += 1
                        print(f"[{idx}/{total}] ✗ brak danych: {url.split('/')[-1][:50]}")
                    await asyncio.sleep(0.8 + random.uniform(0, 0.4))
                finally:
                    await page_pool.put(p)

        tasks = [
            scrape_one(url, cat, i + 1, len(to_scrape))
            for i, (url, cat) in enumerate(to_scrape)
        ]

        # Wykonuj partiami i zapisuj co 50
        batch = 50
        for i in range(0, len(tasks), batch):
            await asyncio.gather(*tasks[i:i + batch])
            save_products(existing)
            save_names(existing)
            if i + batch < len(tasks):
                print(f"  → Zapisano {len(existing)} produktów (checkpoint)")

        for p in pages:
            await p.close()
        await browser.close()

    save_products(existing)
    save_names(existing)

    by_cat: dict[str, int] = {}
    for r in existing.values():
        cat = r["category"].split(" > ")[0] if " > " in r["category"] else r["category"]
        by_cat[cat] = by_cat.get(cat, 0) + 1

    print(f"\nGotowe!")
    print(f"  Nowe:      {new_count}")
    print(f"  Pominięte: {skipped}")
    print(f"  Błędy:     {fail_count}")
    for cat, count in sorted(by_cat.items()):
        print(f"  {cat}: {count}")
    print(f"\n  Zapisano: {OUTPUT_FILE}")
    print(f"  Nazwy:    {NAMES_FILE}")


def main():
    ap = argparse.ArgumentParser(description="Scraper produktów Aldi UK")
    ap.add_argument("--limit",    type=int, default=None,
                    help="Max produktów do pobrania")
    ap.add_argument("--category", default=None,
                    help=f"Tylko jedna kategoria: {', '.join(FOOD_CATEGORIES)}")
    ap.add_argument("--filter",   action="store_true",
                    help="Filtruj JSON według aldi_names.txt")
    ap.add_argument("--list",     action="store_true",
                    help="Pokaż zapisane produkty")
    args = ap.parse_args()

    if args.filter:
        filter_by_names()
        return

    if args.list:
        if not OUTPUT_FILE.exists():
            print("Brak pliku wynikowego.")
            return
        products = json.loads(OUTPUT_FILE.read_text("utf-8"))
        by_cat: dict[str, list] = {}
        for p in products:
            by_cat.setdefault(p["category"], []).append(p["name"])
        for cat, names in sorted(by_cat.items()):
            print(f"\n{cat} ({len(names)}):")
            for n in names[:5]:
                print(f"  {n}")
        print(f"\nŁącznie: {len(products)}")
        return

    asyncio.run(run(args))


if __name__ == "__main__":
    main()
