#!/usr/bin/env python3
"""
Biedronka scraper — zakupy.biedronka.pl

Strategia: zbieramy tekst kart produktów ze strony, klikamy "Zobacz więcej",
parsujemy tekst do JSON. Prosto i niezawodnie.

Użycie:
    python biedronka_scraper.py                  # → biedronka_products.json
    python biedronka_scraper.py --debug
    python biedronka_scraper.py --limit 20
    python biedronka_scraper.py --headful
"""

import asyncio
import json
import re
import sys
import argparse
import random
from pathlib import Path

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

# ─── Kategorie ─────────────────────────────────────────────────────────────────

CATEGORIES = [
    ("Warzywa",            "https://zakupy.biedronka.pl/warzywa/",            2),
    ("Owoce",              "https://zakupy.biedronka.pl/owoce/",              1),
    ("Piekarnia",          "https://zakupy.biedronka.pl/piekarnia/",          2),
    ("Nabiał",             "https://zakupy.biedronka.pl/nabial/",             5),
    ("Mięso",              "https://zakupy.biedronka.pl/mieso/",              3),
    ("Artykuły spożywcze", "https://zakupy.biedronka.pl/artykuly-spozywcze/",18),
]

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

def jitter(a: int, b: int) -> int:  # Poziom 1
    return random.randint(a, b)


# ─── JavaScript: wyciąga tekst kart produktów ──────────────────────────────────
#
# Szuka elementów z tekstem "X kg - Y,YY zł / kg" lub "X l - Y,YY zł / l"
# (to jest tekst ceny jednostkowej, unikalny dla kart produktów).
# Następnie idzie w górę drzewa DOM żeby znaleźć kartę produktu i zwraca jej tekst.

CARD_TEXT_JS = r"""
() => {
    const seenCards = new Set();
    const results = [];
    // Obsługuje formaty:
    //   "0.5kg - 29,98 zł / kg"
    //   "1szt. - 2,99 zł / szt"
    //   "ok. 300 g ~ 0.3kg - 24,99 zł / kg"
    //   "1szt. – 5,99 zł / szt"
    const unitRe = /[\d.,]+\s*(kg|l|g|ml|szt\.?|opak\.?)\s*[-–~]\s*[\d,\s]+\s*zł\s*\/\s*(kg|l|szt\.?|opak\.?)/i;

    // Szukamy tylko wśród elementów tekstowych (span, p, div bez dzieci)
    for (const el of document.querySelectorAll('p, span, div, li')) {
        if (el.children.length > 2) continue;
        const t = (el.innerText || '').trim();
        if (t.length > 80 || !unitRe.test(t)) continue;

        // Idź w górę do karty produktu
        let parent = el.parentElement;
        for (let i = 0; i < 10; i++) {
            if (!parent) break;
            const pt = (parent.innerText || '').trim();
            if (pt.length >= 40 && pt.length <= 600 && !seenCards.has(parent)) {
                seenCards.add(parent);
                results.push(pt);
                break;
            }
            parent = parent.parentElement;
        }
    }
    return results;
}
"""


# ─── Parsowanie tekstu karty produktu ─────────────────────────────────────────

def parse_weight_from_name(name: str) -> tuple[float, str]:
    m = re.search(r"\b(\d+)\s*x\s*(\d+(?:[.,]\d+)?)\s*(g|ml|kg|l)\b", name, re.I)
    if m:
        n, val, u = int(m.group(1)), float(m.group(2).replace(",",".")), m.group(3).lower()
        if "kg" in u: val *= 1000
        elif u == "l": val *= 1000
        return round(n * val, 1), "g" if u in ("g","kg") else "ml"
    for pat, mult, unit in [
        (r"(\d+(?:[.,]\d+)?)\s*kg\b", 1000, "g"),
        (r"(\d+(?:[.,]\d+)?)\s*dag\b", 10,  "g"),
        (r"(\d+(?:[.,]\d+)?)\s*g\b",  1,   "g"),
        (r"(\d+(?:[.,]\d+)?)\s*l\b(?![a-z])", 1000, "ml"),
        (r"(\d+(?:[.,]\d+)?)\s*ml\b", 1, "ml"),
        (r"\b(\d+)\s*szt\b", 1, "szt"),
    ]:
        m2 = re.search(pat, name, re.I)
        if m2:
            return round(float(m2.group(1).replace(",",".")) * mult, 1), unit
    return 100.0, "g"


def parse_card_text(text: str, cat_name: str) -> dict | None:
    """Parsuje surowy innerText karty produktu → słownik produktu."""
    lines = [l.strip() for l in text.split('\n') if l.strip()]

    # 1. Cena — Biedronka wyświetla integer i decimal oddzielnie ("99" + "99" + "/szt.")
    price = None
    for i, line in enumerate(lines):
        if not re.fullmatch(r'\d+', line): continue
        # Szukaj decimal w następnych liniach
        for j in range(i+1, min(i+4, len(lines))):
            if re.fullmatch(r'\d{2}', lines[j]):
                candidate = float(f"{line}.{lines[j]}")
                if 0 < candidate <= 5000:
                    price = candidate
                    break
        if price: break

    if not price:
        # Fallback: X,XX lub X.XX
        m = re.search(r'(\d+)[,.](\d{2})\s*(?:zł|/szt|/opak)', text)
        if m:
            price = float(f"{m.group(1)}.{m.group(2)}")
    if not price:
        return None

    # 2. Cena jednostkowa + waga opakowania
    # Format: "0.69kg - 10,94 zł / kg"
    unit_m = re.search(
        r'([\d.,]+)\s*(kg|g|l|ml|szt\.?|opak\.?)\s*[-–~]\s*([\d,]+)\s*zł\s*\/\s*(kg|l|szt\.?|opak\.?)',
        text, re.I
    )
    unit_price_str = ""
    pkg_weight, pkg_unit = None, "g"
    if unit_m:
        unit_price_str = f"{unit_m.group(3).replace(',','.')} zł/{unit_m.group(4)}"
        w = float(unit_m.group(1).replace(",","."))
        u = unit_m.group(2).lower()
        if "kg" in u: w = round(w * 1000, 1); u = "g"
        elif u == "l": w = round(w * 1000, 1); u = "ml"
        elif u == "dag": w = round(w * 10, 1); u = "g"
        else: w = round(w, 1)
        pkg_weight, pkg_unit = w, u

    # 3. Nazwa — pierwsza linia która nie jest ceną, jednostką ani przyciskiem
    SKIP = re.compile(
        r'^[\d,.\s]+$'            # czyste liczby
        r'|zł\s*\/'               # "zł / kg"
        r'|^\/?(szt|opak|kg|l|ml|100g)\b'  # jednostki
        r'|^\+$'                  # przycisk +
        r'|^[-–]$'                # myślnik
        r'|koszyk|dodano|dodaj|polecamy|sprawdź|więcej', re.I
    )
    UNIT_PRICE_LINE = re.compile(
        r'[\d.,]+\s*(kg|l|g|ml)\s*[-–]\s*[\d,]+\s*zł', re.I
    )
    name = None
    for line in lines:
        if len(line) < 4 or len(line) > 200: continue
        if SKIP.search(line): continue
        if UNIT_PRICE_LINE.search(line): continue
        name = line
        break

    if not name or len(name) < 4:
        return None

    # 4. Na wagę?
    sold_by_weight = bool(re.search(r'\bna\s+wag[ęe]\b', name, re.I))
    if sold_by_weight:
        pkg_weight, pkg_unit = 1000.0, "g"
    elif not pkg_weight:
        pkg_weight, pkg_unit = parse_weight_from_name(name)

    # 5. Oblicz cenę opakowania z ceny jednostkowej × waga
    # Karta Biedronki często nie zawiera czerwonej odznaki z ceną — mamy tylko
    # "0.5kg - 29,98 zł / kg", więc package_price = unit_price × weight
    if unit_m and pkg_weight and pkg_weight > 0 and not sold_by_weight:
        unit_label = unit_m.group(4).lower().rstrip(".")
        if pkg_unit in ("g", "ml") and unit_label in ("kg", "l"):
            unit_val = float(unit_m.group(3).replace(",",".").replace(" ",""))
            pkg_weight_base = pkg_weight / 1000   # g→kg lub ml→l
            computed = round(unit_val * pkg_weight_base, 2)
            if abs(computed - price) > 0.20:
                price = computed
        # Dla szt/opak: price IS cena opakowania — zostaw jak jest

    # 6. Oblicz cenę/kg jeśli brak
    if not unit_price_str and pkg_weight and pkg_weight > 0 and not sold_by_weight:
        if pkg_unit in ("g", "ml"):
            label = "kg" if pkg_unit == "g" else "l"
            unit_price_str = f"{price / pkg_weight * 1000:.2f} zł/{label}"

    return {
        "name":           name[:200],
        "package_size":   "Na wagę" if sold_by_weight else f"{int(pkg_weight)}{pkg_unit}",
        "price":          round(price, 2),
        "price_per_unit": unit_price_str,
        "sold_by_weight": sold_by_weight,
        "_category":      cat_name,
    }


# ─── Ludzki scroll (Poziom 2) ──────────────────────────────────────────────────

async def human_scroll(page: Page, target_y: int = 2500):
    """Scrolluje stopniowo do target_y — wyzwala lazy loading."""
    pos = await page.evaluate("window.scrollY") or 0
    end = max(pos + target_y, target_y)
    while pos < end:
        step = random.randint(200, 420)
        pos = min(pos + step, end)
        await page.evaluate(f"window.scrollTo(0, {pos})")
        await page.wait_for_timeout(jitter(300, 600))
    await page.wait_for_timeout(jitter(600, 1200))


async def scroll_to_bottom(page: Page):
    """Scrolluje stopniowo aż do samego dołu strony (bez skoków)."""
    while True:
        scroll_y   = await page.evaluate("window.scrollY")
        inner_h    = await page.evaluate("window.innerHeight")
        total_h    = await page.evaluate("document.body.scrollHeight")
        if scroll_y + inner_h >= total_h - 50:
            break
        step = random.randint(300, 500)
        await page.evaluate(f"window.scrollBy(0, {step})")
        await page.wait_for_timeout(jitter(300, 550))
    await page.wait_for_timeout(jitter(700, 1200))


# ─── Scraping jednej kategorii ────────────────────────────────────────────────

async def scrape_category(page: Page, cat_name: str, base_url: str,
                           pages: int = 1, limit: int = 0,
                           debug: bool = False) -> list[dict]:
    products: list[dict] = []
    seen: set[str] = set()

    print(f"  [{cat_name}]", end="", flush=True)

    for page_num in range(1, pages + 1):
        url = base_url if page_num == 1 else f"{base_url}?page={page_num}"
        print(f" s{page_num}", end="", flush=True)

        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=40000)
        except Exception as e:
            print(f" ❌{e}")
            continue

        await page.wait_for_timeout(jitter(2500, 4000))
        await human_scroll(page)
        await page.wait_for_timeout(jitter(800, 1500))

        try:
            card_texts = await page.evaluate(CARD_TEXT_JS)
        except Exception as e:
            if debug: print(f"\n  [JS ERROR] {e}")
            continue

        if debug:
            print(f"\n    [strona {page_num}] {len(card_texts)} kart")
            if card_texts:
                print(f"    Tekst karty #0:\n{card_texts[0][:200]}\n")

        for text in card_texts:
            p = parse_card_text(text, cat_name)
            if p and p["name"].lower() not in seen:
                seen.add(p["name"].lower())
                products.append(p)

        if limit and len(products) >= limit:
            break

        if page_num < pages:
            await page.wait_for_timeout(jitter(2000, 4000))  # Poziom 1

    result = products[:limit] if limit else products
    print(f" → {len(result)} produktów")
    return result


# ─── Główna pętla ─────────────────────────────────────────────────────────────

async def main(args):
    all_products: list[dict] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=not args.headful,
            args=["--disable-blink-features=AutomationControlled"],
        )
        # Poziom 3 — Windows UA + timezone
        ctx = await browser.new_context(
            user_agent=UA,
            viewport={"width": 1366, "height": 768},
            locale="pl-PL",
            timezone_id="Europe/Warsaw",
            extra_http_headers={"Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8"},
        )
        page = await ctx.new_page()

        # Poziom 4 — stealth
        if HAS_STEALTH:
            await _stealth.apply_stealth_async(page)

        # Akceptacja cookies
        print("Otwieranie Biedronka...")
        try:
            await page.goto("https://zakupy.biedronka.pl/", wait_until="domcontentloaded", timeout=40000)
            await page.wait_for_timeout(jitter(2000, 3000))
            for sel in (
                "button#onetrust-accept-btn-handler",
                "[aria-label*='Akceptuj' i]",
                "[aria-label*='Accept all' i]",
                "button[class*='accept' i]",
            ):
                try:
                    btn = await page.query_selector(sel)
                    if btn and await btn.is_visible():
                        await btn.click()
                        await page.wait_for_timeout(jitter(1000, 1800))
                        print("  ✓ cookies zaakceptowane")
                        break
                except Exception:
                    pass
        except Exception as e:
            print(f"  ⚠ {e}")

        print()
        for cat_name, cat_url, cat_pages in CATEGORIES:
            try:
                prods = await scrape_category(page, cat_name, cat_url, cat_pages, args.limit, args.debug)
                all_products.extend(prods)
                if not prods:
                    print(f"    ⚠ 0 produktów")
            except Exception as e:
                print(f"  ❌ {cat_name}: {e}")
            await page.wait_for_timeout(jitter(3000, 6000))  # Poziom 1

        await browser.close()

    out = Path(args.out)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(all_products, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*60}")
    print(f"Łącznie: {len(all_products)} produktów → {out}")
    if not all_products:
        print("⚠  0 produktów. Spróbuj: --headful --debug")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit",   type=int, default=0)
    ap.add_argument("--debug",   action="store_true")
    ap.add_argument("--headful", action="store_true")
    ap.add_argument("--out",     default="biedronka_products.json")
    asyncio.run(main(ap.parse_args()))
