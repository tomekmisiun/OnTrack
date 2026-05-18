#!/usr/bin/env python3
"""
Konwertuje catalog_products.json (output scrapera) do pliku seed
który aplikacja Flask używa przy zakładaniu nowych kont.

Użycie:
    python export_seeds.py                          # catalog_products.json → ../app/data/products_seed_pl.json
    python export_seeds.py moje_produkty.json       # własny plik wejściowy
    python export_seeds.py --output /inna/sciezka/products.json
    python export_seeds.py --stats                  # tylko statystyki, nie zapisuj

Plik wyjściowy to prosta lista JSON:
[
  {
    "name": "Banany Premium Auchan na wagę",
    "price": 0.698,
    "package_weight": 1000,
    "unit": "g",
    "sold_by_weight": true,
    "kcal": 89.0,
    "protein": 1.1,
    "fat": 0.3,
    "carbs": 23.0
  },
  ...
]
"""

import json
import argparse
from pathlib import Path

DEFAULT_INPUT  = Path(__file__).parent / "catalog_products.json"
DEFAULT_OUTPUT = Path(__file__).parent.parent / "app" / "data" / "products_seed_pl.json"


def load_catalog(path: Path) -> list[dict]:
    """Wczytuje catalog_products.json — obsługuje oba formaty: lista lub {sklep: []}."""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, list):
        return data
    # Format {auchan: [...], biedronka: [...], carrefour: [...]}
    flat = []
    for store_list in data.values():
        if isinstance(store_list, list):
            flat.extend(store_list)
    return flat


def normalize(products: list[dict]) -> list[dict]:
    """
    Czyści i deduplikuje produkty.
    - Usuwa produkty bez nazwy lub z ceną 0
    - Deduplikuje po nazwie (case-insensitive, zachowuje pierwszy wynik)
    - Sortuje alfabetycznie
    """
    seen: set[str] = set()
    result: list[dict] = []

    for p in products:
        name = (p.get("name") or "").strip()
        if not name or len(name) < 3:
            continue

        key = name.lower()
        if key in seen:
            continue
        seen.add(key)

        pw  = float(p.get("package_weight") or 100)
        sbw = bool(p.get("sold_by_weight", False))

        entry: dict = {
            "name":           name[:200],
            "price":          round(float(p.get("db_price") or p.get("price") or 0), 4),
            "package_weight": max(round(pw, 1), 0.1),
            "unit":           p.get("unit") or "g",
            "sold_by_weight": sbw,
        }
        # Makra — dodaj tylko jeśli są (mogą być None jeśli OFF nie znalazło)
        for macro in ("kcal", "protein", "fat", "carbs"):
            val = p.get(macro)
            if val is not None:
                entry[macro] = round(float(val), 1)

        result.append(entry)

    result.sort(key=lambda x: x["name"].lower())
    return result


def print_stats(products: list[dict]):
    total = len(products)
    with_macro = sum(1 for p in products if p.get("kcal") is not None)
    by_weight  = sum(1 for p in products if p.get("sold_by_weight"))
    in_pkg     = total - by_weight

    units: dict[str, int] = {}
    for p in products:
        u = p.get("unit", "g")
        units[u] = units.get(u, 0) + 1

    print(f"\n── Statystyki ──────────────────────────")
    print(f"  Produktów łącznie:   {total}")
    print(f"  Z makrami (OFF):     {with_macro}  ({with_macro/max(total,1)*100:.0f}%)")
    print(f"  Na wagę:             {by_weight}")
    print(f"  W opakowaniu:        {in_pkg}")
    print(f"  Jednostki:           {dict(sorted(units.items(), key=lambda x: -x[1]))}")
    print(f"────────────────────────────────────────\n")


def main():
    ap = argparse.ArgumentParser(description="Eksportuj produkty scrapera jako seed aplikacji")
    ap.add_argument("input",   nargs="?", default=str(DEFAULT_INPUT),  help=f"Plik wejściowy (domyślnie: {DEFAULT_INPUT.name})")
    ap.add_argument("--output",           default=str(DEFAULT_OUTPUT), help=f"Plik wyjściowy (domyślnie: {DEFAULT_OUTPUT})")
    ap.add_argument("--stats", action="store_true", help="Tylko statystyki, nie zapisuj pliku")
    args = ap.parse_args()

    inp = Path(args.input)
    if not inp.exists():
        print(f"Plik nie istnieje: {inp}")
        return

    print(f"Wczytuję: {inp}")
    raw = load_catalog(inp)
    print(f"Załadowano {len(raw)} surowych wpisów")

    products = normalize(raw)
    print(f"Po normalizacji i deduplikacji: {len(products)} produktów")

    print_stats(products)

    if args.stats:
        return

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)

    print(f"Zapisano → {out}")
    print(f"\nTeraz zrestartuj backend żeby nowi użytkownicy dostali te produkty:")
    print(f"  docker compose restart app\n")


if __name__ == "__main__":
    main()
