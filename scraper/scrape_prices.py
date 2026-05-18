"""
Auchan price scraper.

Usage:
    # Aktualizuj ceny wszystkich zmapowanych produktów:
    python scrape_prices.py

    # Tryb testowy — pokaż co by się zmieniło, nie zapisuj do bazy:
    python scrape_prices.py --dry-run

    # Zbadaj stronę produktu — pokaż jakie ceny znalazł scraper (do debugowania):
    python scrape_prices.py --inspect https://zakupy.auchan.pl/produkty/...

    # Pokaż listę produktów z bazy z ich ID (żeby uzupełnić mappings.json):
    python scrape_prices.py --list-products
"""

import asyncio
import json
import re
import sys
import argparse
from pathlib import Path

import psycopg2

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("Brak playwright. Zainstaluj: pip install playwright && playwright install chromium")
    sys.exit(1)


DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "dbname": "mealplanner",
    "user": "user",
    "password": "password",
}

# Twój user_id z tabeli users (sprawdź: python scrape_prices.py --list-users)
DEFAULT_USER_ID = 2

MAPPINGS_FILE = Path(__file__).parent / "mappings.json"

# Selektory CSS do ceny — próbowane po kolei, pierwszy wynik wygrywa
AUCHAN_PRICE_SELECTORS = [
    "[data-testid='product-price']",
    "[class*='ProductPrice']",
    "[class*='product-price']",
    "[class*='Price__value']",
    "[class*='price-value']",
    "[class*='price__value']",
    ".price",
    "[class*='price']",
]

PRICE_PATTERN = re.compile(r"(\d+[.,]\d{2})\s*zł", re.IGNORECASE)
PRICE_PATTERN_SIMPLE = re.compile(r"(\d+[.,]\d{2})")


def load_mappings():
    with open(MAPPINGS_FILE) as f:
        data = json.load(f)
    return {k: v for k, v in data.items() if not k.startswith("_") and k != "example"}


def get_db():
    return psycopg2.connect(**DB_CONFIG)


def list_users():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT u.id, u.email, COUNT(p.id) as products
        FROM users u LEFT JOIN products p ON p.user_id = u.id
        GROUP BY u.id, u.email ORDER BY u.id
    """)
    rows = cur.fetchall()
    conn.close()
    print(f"\n{'ID':>4}  {'Produktów':>10}  Email")
    print("-" * 50)
    for uid, email, cnt in rows:
        marker = " ← DEFAULT_USER_ID" if uid == DEFAULT_USER_ID else ""
        print(f"{uid:>4}  {cnt:>10}  {email}{marker}")
    print(f"\nZmień DEFAULT_USER_ID w scrape_prices.py jeśli potrzebujesz.")


def list_products(user_id: int):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, name, price FROM products WHERE user_id = %s ORDER BY name", (user_id,))
    rows = cur.fetchall()
    conn.close()
    print(f"\n{'ID':>6}  {'Cena':>8}  Nazwa  (user_id={user_id})")
    print("-" * 60)
    for pid, name, price in rows:
        print(f"{pid:>6}  {price:>7.2f}  {name}")
    print(f"\nŁącznie: {len(rows)} produktów")
    print(f"\nUzupełnij mappings.json wpisując ID jako klucz:")
    print('  "42": { "auchan": "https://zakupy.auchan.pl/products/..." }')


async def extract_biedronka_price(page, url: str) -> float | None:
    """Wyciąga cenę z zakupy.biedronka.pl (split integer/decimal format)."""
    await page.goto(url, wait_until="load", timeout=30000)
    await page.wait_for_timeout(3000)
    return await page.evaluate("""() => {
        const sales = document.querySelector('.price-product__sales');
        if (!sales) return null;
        const decimal = sales.querySelector('.price-product__decimal');
        const dec = decimal ? decimal.innerText.trim() : '00';
        // integer = tekst bezpośrednio w sales (bez dzieci)
        let intText = '';
        for (const node of sales.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                const t = node.textContent.replace(/\\s+/g, '').trim();
                if (/^\\d+$/.test(t)) { intText = t; break; }
            }
        }
        if (!intText) return null;
        return parseFloat(intText + '.' + dec);
    }""")


async def extract_per_kg_price(page, url: str) -> float | None:
    """Wyciąga cenę za kg dla produktów na wagę (salt-vc)."""
    page.on("response", lambda _r: None)
    await page.goto(url, wait_until="load", timeout=30000)
    await page.wait_for_timeout(3000)
    return await page.evaluate("""() => {
        const PRICE_KG = /(\\d+[.,]\\d{2})\\s*zł\\/kg/;
        // Najpierw salt-vc (główny produkt)
        const saltVc = document.querySelector('.salt-vc');
        if (saltVc) {
            const m = saltVc.innerText.match(PRICE_KG);
            if (m) return parseFloat(m[1].replace(',', '.'));
        }
        // Fallback: pierwszy element z /kg poza footer
        const els = document.querySelectorAll('[class*="price"], [class*="Price"], .salt-vc, span');
        for (const el of els) {
            if (el.closest('.footer-container') || el.closest('[class*="footer"]')) continue;
            const txt = el.innerText || '';
            const m = txt.match(PRICE_KG);
            if (m) {
                const val = parseFloat(m[1].replace(',', '.'));
                if (val > 0.05 && val < 9999) return val;
            }
        }
        return null;
    }""")


async def extract_price_from_page(page, url: str) -> float | None:
    """Ładuje stronę i próbuje wyciągnąć cenę różnymi metodami."""

    intercepted_prices = []

    async def handle_response(response):
        if "application/json" not in response.headers.get("content-type", ""):
            return
        try:
            body = await response.json()
            text = json.dumps(body)
            matches = PRICE_PATTERN.findall(text)
            if matches:
                for m in matches:
                    try:
                        intercepted_prices.append(float(m.replace(",", ".")))
                    except ValueError:
                        pass
        except Exception:
            pass

    page.on("response", handle_response)

    await page.goto(url, wait_until="load", timeout=30000)
    await page.wait_for_timeout(3000)

    # Metoda 1: JavaScript — znajdź cenę poza footer/karuzelą, bez "/kg"
    price = await page.evaluate("""() => {
        const PRICE_RE = /(\\d+[.,]\\d{2})\\s*zł/;
        const els = document.querySelectorAll('[class*="price"], [class*="Price"], [class*="display"]');
        for (const el of els) {
            // Pomiń elementy w footer (karuzela polecanych)
            if (el.closest('.footer-container') || el.closest('[class*="footer"]')) continue;
            const txt = el.innerText || '';
            // Pomiń ceny jednostkowe (za kg, litr, itp.)
            if (txt.includes('/kg') || txt.includes('/l') || txt.includes('porcja')) continue;
            const m = txt.match(PRICE_RE);
            if (m) {
                const val = parseFloat(m[1].replace(',', '.'));
                if (val > 0.05 && val < 9999) return val;
            }
        }
        return null;
    }""")
    if price:
        return price

    # Metoda 2: pełny tekst poza footer — regex na czystych cenach
    main_text = await page.evaluate("""() => {
        const footer = document.querySelector('.footer-container, [class*="footer"]');
        if (footer) footer.remove();
        return document.body.innerText;
    }""")
    matches = PRICE_PATTERN.findall(main_text)
    candidates = []
    for m in matches:
        val = float(m.replace(",", "."))
        if 0.1 < val < 9999:
            candidates.append(val)
    if candidates:
        return candidates[0]

    # Metoda 3: z przechwyconych XHR
    if intercepted_prices:
        valid = [p for p in intercepted_prices if 0.1 < p < 9999]
        if valid:
            return min(valid)

    return None


async def inspect_url(url: str):
    """Tryb debugowania — pokaż wszystko co znalazł scraper."""
    print(f"\nInspecting: {url}\n")
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        all_prices_from_xhr = []

        async def handle_response(response):
            if "application/json" not in response.headers.get("content-type", ""):
                return
            try:
                body = await response.json()
                text = json.dumps(body)
                matches = PRICE_PATTERN.findall(text)
                if matches:
                    all_prices_from_xhr.extend(matches)
            except Exception:
                pass

        page.on("response", handle_response)
        await page.goto(url, wait_until="load", timeout=30000)
        await page.wait_for_timeout(3000)

        print("=== Selektory CSS ===")
        for selector in AUCHAN_PRICE_SELECTORS:
            try:
                elements = await page.query_selector_all(selector)
                if elements:
                    for el in elements[:3]:
                        text = (await el.inner_text()).strip()
                        if text:
                            print(f"  [{selector}] → {repr(text[:80])}")
            except Exception:
                pass

        print("\n=== Ceny z tekstu strony (pattern: X.XX zł) ===")
        body_text = await page.inner_text("body")
        matches = PRICE_PATTERN.findall(body_text)
        for m in matches[:10]:
            print(f"  {m} zł")

        print("\n=== Ceny z XHR/API ===")
        for m in all_prices_from_xhr[:10]:
            print(f"  {m} zł")

        price = await extract_price_from_page(page, url)
        print(f"\n>>> Wykryta cena końcowa: {price} zł" if price else "\n>>> Nie udało się wykryć ceny.")

        await browser.close()


async def run_scraper(dry_run: bool):
    mappings = load_mappings()
    if not mappings:
        print("Brak mapowań w mappings.json. Dodaj produkty i spróbuj ponownie.")
        return

    conn = get_db()
    cur = conn.cursor()

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        results = []

        for product_id, stores in mappings.items():
            auchan_url    = stores.get("auchan")
            biedronka_url = stores.get("biedronka")
            if not auchan_url and not biedronka_url:
                continue
            # Preferuj Auchan, fallback do Biedronki
            active_url  = auchan_url or biedronka_url
            store_name  = "Auchan" if auchan_url else "Biedronka"

            cur.execute("SELECT name, price, package_weight, unit, sold_by_weight FROM products WHERE id = %s AND user_id = %s", (product_id, DEFAULT_USER_ID))
            row = cur.fetchone()
            if not row:
                print(f"[WARN] Produkt ID={product_id} nie istnieje w bazie.")
                continue

            name, old_price, package_weight, unit, sold_by_weight = row
            print(f"Scraping: {name} (ID={product_id}) [{store_name}]...", end=" ", flush=True)

            try:
                per_kg = stores.get("per_kg", False)
                if biedronka_url and not auchan_url:
                    new_price = await extract_biedronka_price(page, active_url)
                elif per_kg:
                    new_price = await extract_per_kg_price(page, active_url)
                else:
                    new_price = await extract_price_from_page(page, active_url)
                if new_price is None:
                    print("❌ Nie znaleziono ceny")
                    results.append({"id": product_id, "name": name, "status": "not_found"})
                    continue

                # Konwertuj cenę opakowania/kg → cenę jednostkową (per 100g lub per szt)
                pkg = float(package_weight) or 1
                biedronka_pkg_g = stores.get("biedronka_pkg_g")  # gdy Biedronka zwraca cenę paczki (nie /kg)
                if biedronka_pkg_g and biedronka_url and per_kg:
                    db_price = new_price / (biedronka_pkg_g / 100)  # cena_paczki / (g/100) → /100g
                elif per_kg or sold_by_weight:
                    db_price = new_price / 10          # /kg → /100g
                elif unit == 'szt':
                    db_price = new_price / pkg         # cena opakowania → cena/szt
                else:
                    db_price = new_price / pkg * 100   # cena opakowania → cena/100g

                changed = abs(db_price - float(old_price)) > 0.001
                arrow = f"{old_price:.4f} → {db_price:.4f} (opak: {new_price:.2f} zł)" if changed else f"{old_price:.4f} (bez zmian)"
                print(f"✓ {arrow}")

                if changed and not dry_run:
                    cur.execute("UPDATE products SET price = %s WHERE id = %s", (db_price, product_id))
                    conn.commit()

                results.append({
                    "id": product_id, "name": name,
                    "old": float(old_price), "new": db_price,
                    "changed": changed, "status": "ok",
                })
            except Exception as e:
                print(f"❌ Błąd: {e}")
                results.append({"id": product_id, "name": name, "status": "error", "error": str(e)})

        await browser.close()

    conn.close()

    print("\n" + "=" * 50)
    ok      = [r for r in results if r["status"] == "ok"]
    changed = [r for r in ok if r.get("changed")]
    errors  = [r for r in results if r["status"] in ("error", "not_found")]

    print(f"Wynik: {len(ok)} OK, {len(changed)} zmienionych, {len(errors)} błędów")
    if dry_run:
        print("(tryb --dry-run, żadne zmiany nie zostały zapisane)")


def main():
    parser = argparse.ArgumentParser(description="Auchan price scraper")
    parser.add_argument("--dry-run",       action="store_true", help="Nie zapisuj do bazy")
    parser.add_argument("--inspect",       metavar="URL",       help="Debuguj konkretny URL")
    parser.add_argument("--list-products", action="store_true", help="Pokaż produkty z bazy z ID")
    parser.add_argument("--list-users",    action="store_true", help="Pokaż użytkowników i ich ID")
    args = parser.parse_args()

    if args.list_users:
        list_users()
    elif args.list_products:
        list_products(DEFAULT_USER_ID)
    elif args.inspect:
        asyncio.run(inspect_url(args.inspect))
    else:
        asyncio.run(run_scraper(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
