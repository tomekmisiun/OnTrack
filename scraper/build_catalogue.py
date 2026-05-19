"""
Pipeline: auchan_products.json + biedronka_products.json → catalogue.json

Dla każdego keyword z product_keywords.py:
  - szuka wszystkich produktów które zawierają ten keyword w nazwie
  - wyciąga najczęstszą gramaturę / unit
  - liczy medianę ceny za 100g (lub za szt)
  - zapisuje dopasowane przykłady do wglądu

Wynik: catalogue.json — gotowy do przejrzenia i późniejszego importu do bazy.

Użycie:
    python build_catalogue.py                     # domyślnie → catalogue.json
    python build_catalogue.py --out my_cat.json
    python build_catalogue.py --show-unmatched    # pokaż niedopasowane produkty
"""

import argparse
import json
import re
from collections import Counter
from statistics import median
from pathlib import Path

from product_keywords import PRODUCT_KEYWORDS

SOURCES = ["auchan_products.json", "biedronka_products.json"]

# Produkty pasujące do dowolnego z tych wzorców są wyrzucane, nawet jeśli
# trafią w keyword. Kolejność nie ma znaczenia.
SKIP_PATTERNS = [
    # gotowe dania / instant
    r"b?łyskawiczn",
    r"instant",
    r"w proszku",
    r"zupa ",
    r"danie gotowe",
    r"gotowe danie",
    r"do przygotowania",
    r"ekspresow",
    r"w saszetce",
    r"w torebce",
    # napoje
    r"napój",
    r"sok ",
    r"nektar",
    r"lemoniada",
    r"smoothie",
    r"koktajl",
    r"ice tea",
    r"kawa ",
    r"herbata",
    r"napar",
    r"syrop",
    r"woda ",
    r"napój jogurtow",
    r"actimel",
    r"activia",
    # słodycze / desery
    r"czekolad",        # zostaje "Czekolada gorzka" keyword — tu wyrzuca produkty z "czekolad" w środku opisu
    r"\blody\b",
    r"lód ",
    r"wafel",
    r"wafle",
    r"baton",
    r"ciastk",
    r"biszkopt",
    r"piernik",
    r"tort ",
    r"sernik",
    r"budyń",
    r"kisiel",
    r"galaretka",
    r"żelek",
    r"guma do żucia",
    # suplementy / odżywki / białka w proszku
    r"suplement",
    r"odżywka",
    r"białko serwatk",
    r"białko wpc",
    r"whey",
    r"\bwpc\b",
    r"\bwpi\b",
    r"\bwph\b",
    r"kreatyna",
    r"\bbcaa\b",
    r"proteinow",
    r"protein complex",
    r"body active",
    r"kolagen",
    r"witamin",
    r"omega.?3",
    r"o smaku",           # "o smaku bananowym" = smakowy produkt
    r"smaku ",            # "smaku wanilii" itp.
    # mieszanki / dressingi gotowe
    r"mieszanka przypraw",
    r"sos sałatkowy",
    r"dressing",
    r"marynata",
    r"w sosie",
    r"w zalewie",
    r"w oleju",
    # zestawy / wielopaki
    r"\d+ x \d+",        # "4 x 100g" itp.
    r"zestaw",
    r"wielopak",
    # dla dzieci / niemowląt
    r"dla niemowl",
    r"po \d+\. miesiącu",
    r"\bhipp\b",
    r"\bgerber\b",
    r"kaszka",
    r"kluseczki",
    r"papka",
]

_SKIP_RE = re.compile("|".join(SKIP_PATTERNS), re.IGNORECASE)


# ─── parsowanie rozmiaru opakowania ──────────────────────────────────────────

def parse_package_size(raw: str) -> tuple[float | None, str]:
    """Zwraca (waga_w_liczbie, jednostka) albo (None, 'szt')."""
    if not raw:
        return None, "g"
    raw = raw.strip().lower()
    if raw in ("na wagę", "na_wagę", "brak"):
        return None, "g"  # sold_by_weight

    # "1.5kg" / "1,5kg" → g
    m = re.match(r"([\d.,]+)\s*kg$", raw)
    if m:
        return round(float(m.group(1).replace(",", ".")) * 1000), "g"

    # "500g" / "500 g"
    m = re.match(r"([\d.,]+)\s*g$", raw)
    if m:
        return round(float(m.group(1).replace(",", "."))), "g"

    # "500ml" / "0.5l"
    m = re.match(r"([\d.,]+)\s*ml$", raw)
    if m:
        return round(float(m.group(1).replace(",", "."))), "ml"
    m = re.match(r"([\d.,]+)\s*l$", raw)
    if m:
        return round(float(m.group(1).replace(",", ".")) * 1000), "ml"

    # "3szt" / "6 x 100g" → bierzemy liczbę sztuk jako wagę
    m = re.match(r"([\d]+)\s*szt", raw)
    if m:
        return int(m.group(1)), "szt"

    return None, "g"


def parse_price_per_unit(raw: str) -> tuple[float | None, str]:
    """
    Zwraca (cena_za_100g_lub_szt, jednostka_rozliczenia).
    '27.60 zł/kg'   → (2.76, 'g')
    '3.99 zł/szt'   → (3.99, 'szt')
    '29.98 zł/litr' → (2.998, 'ml')
    '12.50 zł/100g' → (12.50, 'g')  ← niektóre sklepy podają per 100g
    """
    if not raw:
        return None, "g"
    raw = raw.strip()
    m = re.match(r"([\d.,]+)\s*zł/(kg|litr|litrów|l)\b", raw, re.IGNORECASE)
    if m:
        unit = "ml" if m.group(2).lower().startswith("l") else "g"
        return round(float(m.group(1).replace(",", ".")) / 10, 4), unit

    m = re.match(r"([\d.,]+)\s*zł/100\s*g", raw, re.IGNORECASE)
    if m:
        return round(float(m.group(1).replace(",", ".")), 4), "g"

    m = re.match(r"([\d.,]+)\s*zł/szt", raw, re.IGNORECASE)
    if m:
        return round(float(m.group(1).replace(",", ".")), 4), "szt"

    return None, "g"


# ─── ładowanie danych ─────────────────────────────────────────────────────────

def load_all() -> list[dict]:
    products = []
    for src in SOURCES:
        p = Path(src)
        if not p.exists():
            print(f"  [BRAK] {src}")
            continue
        data = json.loads(p.read_text(encoding="utf-8"))
        for item in data:
            item["_source"] = p.stem
        products.extend(data)
        print(f"  Załadowano {len(data):4d} produktów z {src}")
    return products


# ─── dopasowanie keyword → produkt ───────────────────────────────────────────

def find_keyword(name: str, keywords: list[str]) -> str | None:
    """
    Zwraca pierwszy keyword który pasuje jako całe słowo/wyrażenie w nazwie.
    Użycie \b word boundary zapobiega fałszywym dopasowaniom:
    'Mak' nie trafi w 'Makaron' ani 'Smak'.
    """
    lower = name.lower()
    for kw in keywords:
        pattern = r"\b" + re.escape(kw.lower()) + r"\b"
        if re.search(pattern, lower):
            return kw
    return None


def should_skip(name: str) -> bool:
    """True jeśli produkt powinien być wyrzucony bez względu na keyword."""
    return bool(_SKIP_RE.search(name))


def match_products(products: list[dict], keywords: list[str]) -> dict[str, list[dict]]:
    """
    Zwraca słownik keyword → lista pasujących produktów.
    Produkty bez dopasowania LUB pasujące do SKIP_PATTERNS trafiają pod klucz None.
    """
    sorted_kw = sorted(keywords, key=len, reverse=True)

    groups: dict[str | None, list[dict]] = {kw: [] for kw in keywords}
    groups[None] = []

    skipped = 0
    for p in products:
        if should_skip(p["name"]):
            groups[None].append(p)
            skipped += 1
            continue
        kw = find_keyword(p["name"], sorted_kw)
        groups.setdefault(kw, []).append(p)

    print(f"  Wyrzucono (SKIP):  {skipped}")
    return groups


# ─── agregacja grupy ──────────────────────────────────────────────────────────

def aggregate_group(keyword: str, products: list[dict]) -> dict:
    """Tworzy jeden kanoniczny rekord z grupy produktów."""

    weights_g  = []
    weights_ml = []
    weights_szt= []
    prices_g   = []
    prices_ml  = []
    prices_szt = []
    sold_by_weight_count = 0

    for p in products:
        sbw = bool(p.get("sold_by_weight"))
        if sbw:
            sold_by_weight_count += 1

        raw_size = p.get("package_size", "")
        if raw_size and raw_size.lower() not in ("na wagę", "na_wagę"):
            w, unit = parse_package_size(raw_size)
            if w and w > 0:
                if unit == "g":   weights_g.append(w)
                elif unit == "ml": weights_ml.append(w)
                elif unit == "szt": weights_szt.append(w)

        price_val, price_unit = parse_price_per_unit(p.get("price_per_unit", ""))
        if price_val and price_val > 0:
            if price_unit == "g":    prices_g.append(price_val)
            elif price_unit == "ml": prices_ml.append(price_val)
            elif price_unit == "szt": prices_szt.append(price_val)

    # Wybierz dominującą jednostkę wagową
    counts = {"g": len(weights_g), "ml": len(weights_ml), "szt": len(weights_szt)}
    dominant_unit = max(counts, key=counts.get)

    sbw_ratio = sold_by_weight_count / len(products)
    is_sbw = sbw_ratio > 0.5

    if is_sbw:
        dominant_unit = "g"
        package_weight = None
    elif dominant_unit == "g" and weights_g:
        package_weight = Counter(weights_g).most_common(1)[0][0]
    elif dominant_unit == "ml" and weights_ml:
        package_weight = Counter(weights_ml).most_common(1)[0][0]
    elif dominant_unit == "szt" and weights_szt:
        package_weight = Counter(weights_szt).most_common(1)[0][0]
    else:
        package_weight = None

    # Mediana ceny za 100g/ml/szt
    if dominant_unit == "g" and prices_g:
        price_median = round(median(prices_g), 4)
    elif dominant_unit == "ml" and prices_ml:
        price_median = round(median(prices_ml), 4)
    elif dominant_unit == "szt" and prices_szt:
        price_median = round(median(prices_szt), 4)
    else:
        price_median = None

    return {
        "name":           keyword,
        "unit":           dominant_unit,
        "package_weight": package_weight,
        "sold_by_weight": is_sbw,
        "price":          price_median,
        "matched_count":  len(products),
        "sources": {
            "auchan":    sum(1 for p in products if p.get("_source") == "auchan_products"),
            "biedronka": sum(1 for p in products if p.get("_source") == "biedronka_products"),
        },
        "sample_names": [p["name"] for p in products[:8]],
    }


# ─── main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out",             default="catalogue.json")
    parser.add_argument("--show-unmatched",  action="store_true")
    args = parser.parse_args()

    print("=== Ładowanie danych ===")
    products = load_all()
    print(f"  Łącznie: {len(products)} produktów\n")

    print("=== Dopasowywanie keywords ===")
    groups = match_products(products, PRODUCT_KEYWORDS)

    matched   = sum(len(v) for k, v in groups.items() if k is not None)
    unmatched = len(groups.get(None, []))
    print(f"  Dopasowano:    {matched} / {len(products)}")
    print(f"  Niedopasowane: {unmatched}\n")

    # Buduj katalog tylko dla keywords które cokolwiek złapały
    catalogue = []
    empty_keywords = []
    for kw in PRODUCT_KEYWORDS:
        hits = groups.get(kw, [])
        if not hits:
            empty_keywords.append(kw)
            continue
        catalogue.append(aggregate_group(kw, hits))

    catalogue.sort(key=lambda x: x["matched_count"], reverse=True)

    print(f"=== Wynik ===")
    print(f"  Keywords z dopasowaniem: {len(catalogue)}")
    print(f"  Keywords bez dopasowania: {len(empty_keywords)}")
    if empty_keywords:
        print(f"  Brak produktów dla: {', '.join(empty_keywords[:10])}"
              + ("..." if len(empty_keywords) > 10 else ""))

    print(f"\n  Top 15 grup:")
    for entry in catalogue[:15]:
        print(f"    [{entry['matched_count']:3d}] {entry['name']:<30s} "
              f"waga={entry['package_weight']} {entry['unit']}  "
              f"cena={entry['price']}")

    # Zapisz
    out_path = Path(args.out)
    out_path.write_text(
        json.dumps(catalogue, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print(f"\n  Zapisano → {out_path}  ({len(catalogue)} wpisów)")

    if args.show_unmatched:
        print(f"\n=== Niedopasowane ({unmatched}) ===")
        for p in sorted(groups[None], key=lambda x: x["name"])[:60]:
            print(f"  {p['name']}")
        if unmatched > 60:
            print(f"  ... i {unmatched - 60} więcej")


if __name__ == "__main__":
    main()
