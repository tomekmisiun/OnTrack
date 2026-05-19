#!/usr/bin/env python3
"""
Carrefour scraper — www.carrefour.pl

Strategia: SSR (produkty są w HTML), iteracja po stronach ?page=N (0-indexed).
Pierwsza strona: bez parametru, druga: ?page=1, trzecia: ?page=2, itd.

Użycie:
    python carrefour_scraper.py                  # → carrefour_products.json
    python carrefour_scraper.py --debug
    python carrefour_scraper.py --limit 20
    python carrefour_scraper.py --headful
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

# (nazwa, url, liczba_stron)  — strony: 1=brak param, 2=?page=1, itd.
CATEGORIES = [
    ("Owoce, warzywa, zioła",  "https://www.carrefour.pl/owoce-warzywa-ziola",        6),
    ("Mięso",                  "https://www.carrefour.pl/mieso",                       3),
    ("Wędliny i kiełbasy",     "https://www.carrefour.pl/wedliny-kielbasy",            5),
    ("Ryby i owoce morza",     "https://www.carrefour.pl/ryby-i-owoce-morza",          3),
    ("Mleko, nabiał, jaja",    "https://www.carrefour.pl/mleko-nabial-jaja",          18),
    ("Piekarnia, ciastkarnia", "https://www.carrefour.pl/piekarnia-ciastkarnia",       2),
    ("Artykuły spożywcze",     "https://www.carrefour.pl/artykuly-spozywcze",         89),
    ("Zdrowa żywność",         "https://www.carrefour.pl/zdrowa-zywnosc",              7),
    ("Mrożonki",               "https://www.carrefour.pl/mrozonki",                    8),
]

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

def jitter(a: int, b: int) -> int:
    return random.randint(a, b)


# ─── JavaScript: wyciąga tekst kart produktów ─────────────────────────────────
#
# Carrefour: cena jednostkowa ma format "55,50 zł/1 kg" lub "1,50 zł/1 szt."
# Używamy tego jako kotwicy do znalezienia karty produktu.

CARD_TEXT_JS = r"""
() => {
    const seenCards = new Set();
    const results = [];

    // Format Carrefour: "55,50 zł/1 kg", "1,50 zł/1 szt.", "19,99 zł/1 l"
    const unitRe = /[\d,]+\s*zł\s*\/\s*1\s*(kg|l|szt\.?|opak\.?)/i;

    for (const el of document.querySelectorAll('p, span, div, li')) {
        if (el.children.length > 3) continue;
        const t = (el.innerText || '').trim();
        if (t.length > 60 || !unitRe.test(t)) continue;

        // Idź w górę do karty produktu
        let parent = el.parentElement;
        for (let i = 0; i < 12; i++) {
            if (!parent) break;
            const pt = (parent.innerText || '').trim();
            if (pt.length >= 30 && pt.length <= 800 && !seenCards.has(parent)) {
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

# JavaScript wykrywa całkowitą liczbę produktów w kategorii
TOTAL_PRODUCTS_JS = """
() => {
    const text = document.body.innerText || '';
    // "znaleziono 341 produktów" lub "Znaleziono 341 produktów"
    const m = text.match(/znaleziono\\s+(\\d+)\\s+produkt/i);
    return m ? parseInt(m[1]) : 0;
}
"""


# ─── Parsowanie tekstu karty ────────────────────────────────────────────────────

def parse_weight(name: str) -> tuple[float, str]:
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
    lines = [l.strip() for l in text.split('\n') if l.strip()]

    # 1. Cena — "9,99 zł" lub "9\n99" (superscript)
    price = None
    for i, line in enumerate(lines):
        # Format "9,99 zł" lub "9.99"
        m = re.match(r'^(\d+)[,.](\d{2})\s*(?:zł)?$', line)
        if m:
            candidate = float(f"{m.group(1)}.{m.group(2)}")
            if 0 < candidate <= 5000:
                price = candidate
                break
        # Format split: "9" + "99" (jak Biedronka)
        if re.fullmatch(r'\d+', line) and i+1 < len(lines):
            for j in range(i+1, min(i+4, len(lines))):
                if re.fullmatch(r'\d{2}', lines[j]):
                    c = float(f"{line}.{lines[j]}")
                    if 0 < c <= 5000:
                        price = c
                        break
            if price: break
    if not price:
        m = re.search(r'(\d+)[,.](\d{2})\s*zł', text)
        if m:
            price = float(f"{m.group(1)}.{m.group(2)}")
    if not price:
        return None

    # 2. Cena jednostkowa — "55,50 zł/1 kg"
    unit_m = re.search(r'([\d,]+)\s*zł\s*\/\s*1\s*(kg|l|szt\.?|opak\.?)', text, re.I)
    unit_price_str = ""
    pkg_weight, pkg_unit = None, "g"
    if unit_m:
        unit_val = float(unit_m.group(1).replace(",","."))
        unit_label = unit_m.group(2).lower().rstrip(".")
        unit_price_str = f"{unit_val:.2f} zł/{unit_label}"
        # Oblicz wagę opakowania: pkg_weight = price / unit_price × 1000
        if unit_label in ("kg","l") and unit_val > 0:
            w = price / unit_val * 1000
            pkg_weight = round(w)
            pkg_unit = "g" if unit_label == "kg" else "ml"
        elif unit_label in ("szt","opak"):
            pkg_weight = 1
            pkg_unit = "szt"

    # 3. Waga z tekstu "0,18 kg" lub "~0,5 kg" (ważone)
    weight_m = re.search(r'~?([\d,]+)\s*kg\b', text, re.I)
    if weight_m and not pkg_weight:
        w = float(weight_m.group(1).replace(",",".")) * 1000
        pkg_weight = round(w)
        pkg_unit = "g"

    # 4. Sprzedaż na wagę — "ważone" w nazwie lub tekście
    sold_by_weight = bool(re.search(r'\bważon\w*\b|\bna\s+wag[ęe]\b', text, re.I))

    # 5. Nazwa — pierwsza sensowna linia
    SKIP = re.compile(
        r'^[\d,.\s]+(?:zł)?$'         # czyste liczby/ceny
        r'|zł\s*\/\s*1'               # "zł/1 kg"
        r'|^dodaj|^zapisa[ćc]|^lista|^koszyk'  # przyciski
        r'|^produkt carrefour'         # badge
        r'|^\d+,\d+\s*kg$'            # "0,18 kg" (sama waga)
        r'|^~'
        r'|^-?\d+\s*%'                # badge promocyjny "-47%", "40%"
        r'|cena sprzed|drugi \d|taniej', re.I
    )
    name = None
    for line in lines:
        if len(line) < 3 or len(line) > 200: continue
        if SKIP.search(line): continue
        name = line
        break
    if not name or len(name) < 3:
        return None

    # 6. Uzupełnij wagę z nazwy jeśli brak
    if sold_by_weight:
        pkg_weight, pkg_unit = 1000, "g"
    elif not pkg_weight:
        pkg_weight, pkg_unit = parse_weight(name)

    # 7. Cena/kg jeśli brak
    if not unit_price_str and pkg_weight and pkg_weight > 0 and not sold_by_weight:
        if pkg_unit in ("g","ml"):
            label = "kg" if pkg_unit=="g" else "l"
            unit_price_str = f"{price/pkg_weight*1000:.2f} zł/{label}"

    return {
        "name":           name[:200],
        "package_size":   "Na wagę" if sold_by_weight else f"{int(pkg_weight)}{pkg_unit}",
        "price":          round(price, 2),
        "price_per_unit": unit_price_str,
        "sold_by_weight": sold_by_weight,
        "_category":      cat_name,
    }


# ─── Generyczny search JSON (dla API responses) ───────────────────────────────

PRODUCT_LIST_KEYS = {
    "products","items","results","data","hits","records",
    "productList","entries","searchResults","catalogue","plpItems",
}

def _extract_product_from_json(item: dict) -> dict | None:
    if not isinstance(item, dict): return None
    name = next((str(item[k]).strip() for k in ("name","displayName","title","productName")
                 if k in item and isinstance(item[k],str) and len(item[k])>2), None)
    if not name: return None
    price = None
    for k in ("price","regularPrice","salePrice","finalPrice"):
        v = item.get(k)
        if isinstance(v,(int,float)) and v>0: price=float(v); break
        if isinstance(v,dict):
            for ik in ("value","amount","gross"):
                if ik in v and isinstance(v[ik],(int,float)) and v[ik]>0:
                    price=float(v[ik]); break
            if price: break
    if not price or price>5000: return None
    pkg_weight, pkg_unit = parse_weight(name)
    unit_str = ""
    if pkg_weight > 0 and pkg_unit in ("g","ml"):
        label = "kg" if pkg_unit=="g" else "l"
        unit_str = f"{price/pkg_weight*1000:.2f} zł/{label}"
    return {
        "name": name[:200],
        "package_size": f"{int(pkg_weight)}{pkg_unit}",
        "price": round(price,2),
        "price_per_unit": unit_str,
        "sold_by_weight": False,
        "_category": "",
    }

def search_json(data, depth: int = 0) -> list[dict]:
    if depth > 10: return []
    found = []
    if isinstance(data, list):
        for item in data:
            p = _extract_product_from_json(item)
            if p: found.append(p)
            elif isinstance(item,(dict,list)): found.extend(search_json(item, depth+1))
    elif isinstance(data, dict):
        for key, val in data.items():
            if key in PRODUCT_LIST_KEYS and isinstance(val, list):
                sub = search_json(val, depth)
                if sub: found.extend(sub); continue
            if isinstance(val,(dict,list)):
                found.extend(search_json(val, depth+1))
    return found


# ─── Ludzki scroll ─────────────────────────────────────────────────────────────

async def human_scroll(page: Page, target: int = 2500):
    pos = await page.evaluate("window.scrollY") or 0
    end = pos + target
    while pos < end:
        pos = min(pos + random.randint(200,400), end)
        await page.evaluate(f"window.scrollTo(0,{pos})")
        await page.wait_for_timeout(jitter(300,600))
    await page.wait_for_timeout(jitter(600,1200))


# ─── Scraping jednej kategorii ────────────────────────────────────────────────

async def human_click_next(page: Page) -> bool:
    """Kliknie przycisk następnej strony jak człowiek."""
    try:
        # Scrolluj do dołu żeby paginacja była w DOM
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await page.wait_for_timeout(jitter(1500, 2500))

        # scrollIntoView + pobierz koordynaty PO scrollowaniu
        btn_info = await page.evaluate(r"""() => {
            const zEl = [...document.querySelectorAll('p, span, div')].find(
                el => el.children.length === 0 && /^z\s*\d+$/.test((el.innerText||'').trim())
            );
            if (!zEl) return null;
            let container = zEl.parentElement;
            for (let i = 0; i < 5; i++) {
                if (!container) break;
                const next = [...container.querySelectorAll('button')]
                    .filter(b => !b.disabled && !b.classList.contains('Mui-disabled')).pop();
                if (next) {
                    // Najpierw scroll do elementu, potem pobierz pozycję w viewport
                    next.scrollIntoView({block: 'center', behavior: 'instant'});
                    const r = next.getBoundingClientRect();
                    return {x: r.x, y: r.y, w: r.width, h: r.height};
                }
                container = container.parentElement;
            }
            return null;
        }""")

        if not btn_info:
            return False

        # Poziom 2 — symulacja czytania: wheel góra/dół przed klikiem
        await page.wait_for_timeout(jitter(400, 800))
        await page.mouse.wheel(0, random.randint(100, 300))
        await page.wait_for_timeout(jitter(500, 1000))
        await page.mouse.wheel(0, random.randint(-150, -50))
        await page.wait_for_timeout(jitter(300, 700))

        # Poziom 2 — klik w losowym miejscu (nie idealnie w środku)
        click_x = btn_info["x"] + random.uniform(5, max(6, btn_info["w"] - 5))
        click_y = btn_info["y"] + random.uniform(3, max(4, btn_info["h"] - 3))

        await page.wait_for_timeout(jitter(800, 2000))  # Poziom 1
        await page.mouse.click(click_x, click_y)
        return True

    except Exception as e:
        print(f"\n    [human_click_next ERROR] {e}")
        return False


async def scrape_category(page: Page, cat_name: str, base_url: str,
                           num_pages: int = 1, limit: int = 0,
                           debug: bool = False) -> list[dict]:
    products: list[dict] = []
    seen: set[str] = set()
    print(f"  [{cat_name}]", end="", flush=True)

    # Strona 1: pełne załadowanie (SSR)
    try:
        await page.goto(base_url, wait_until="load", timeout=45000)
    except Exception as e:
        print(f" ❌ {e}")
        return []

    for sel in ("button#onetrust-accept-btn-handler",
                "[aria-label*='Akceptuj' i]", "button[class*='accept' i]"):
        try:
            btn = await page.query_selector(sel)
            if btn and await btn.is_visible():
                await btn.click()
                await page.wait_for_timeout(jitter(800, 1500))
                break
        except: pass

    await page.wait_for_timeout(jitter(2500, 4000))
    await human_scroll(page, target=2500)
    await page.wait_for_timeout(jitter(800, 1500))

    def extract_from_dom(card_texts):
        new = []
        for text in card_texts:
            p = parse_card_text(text, cat_name)
            if p and p["name"].lower() not in seen:
                seen.add(p["name"].lower())
                products.append(p)
                new.append(p)
        return new

    card_texts = await page.evaluate(CARD_TEXT_JS)
    new = extract_from_dom(card_texts)
    print(f" s1({len(new)})", end="", flush=True)

    if debug:
        print(f"\n    [s1] {len(card_texts)} kart → {len(new)} produktów")

    # Cloudflare blokuje API /web/catalog nawet z browser fingerprint (403).
    # Pobieramy tylko stronę 1 z SSR HTML.

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
        ctx = await browser.new_context(
            user_agent=UA,
            viewport={"width": 1366, "height": 768},
            locale="pl-PL",
            timezone_id="Europe/Warsaw",
            extra_http_headers={"Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8"},
        )
        page = await ctx.new_page()

        if HAS_STEALTH:
            await _stealth.apply_stealth_async(page)

        print("Otwieranie Carrefour...")
        print()
        for cat_name, cat_url, cat_pages in CATEGORIES:
            # Nowy izolowany kontekst dla każdej kategorii
            cat_ctx = await browser.new_context(
                user_agent=UA,
                viewport={"width": 1366, "height": 768},
                locale="pl-PL",
                timezone_id="Europe/Warsaw",
                extra_http_headers={"Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8"},
            )
            cat_page = await cat_ctx.new_page()
            if HAS_STEALTH:
                await _stealth.apply_stealth_async(cat_page)
            try:
                prods = await scrape_category(cat_page, cat_name, cat_url, cat_pages, args.limit, args.debug)
                all_products.extend(prods)
                if not prods:
                    print(f"    ⚠ 0 produktów — uruchom z --debug")
            except Exception as e:
                print(f"  ❌ {cat_name}: {e}")
            finally:
                await cat_ctx.close()
            await asyncio.sleep(jitter(3, 7))

        await browser.close()

    out = Path(args.out)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(all_products, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*60}")
    print(f"Łącznie: {len(all_products)} produktów → {out}")
    if not all_products:
        print("⚠  0 produktów. Uruchom z --debug --headful")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit",   type=int, default=0)
    ap.add_argument("--debug",   action="store_true")
    ap.add_argument("--headful", action="store_true")
    ap.add_argument("--out",     default="carrefour_products.json")
    asyncio.run(main(ap.parse_args()))
