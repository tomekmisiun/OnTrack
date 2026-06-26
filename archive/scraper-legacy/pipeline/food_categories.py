"""
Food product classifier — assigns products to one of 12 standard categories.

Works for both Polish (Auchan, Biedronka) and English (Aldi UK) product names.
Used by all scrapers as a post-processing filter.

Categories and their keywords are defined in:
    scraper/data/reference/food_categories.json  ← edit this file to add/remove keywords

Usage as a script:
    python food_categories.py auchan_products.json
    python food_categories.py aldi_products.json --out aldi_classified.json
    python food_categories.py --stats auchan_products.json
"""

import json
import re
import sys
import argparse
from pathlib import Path

HERE = Path(__file__).parent
SCRAPER_ROOT = HERE.parent
sys.path.insert(0, str(SCRAPER_ROOT))
from data_paths import FOOD_CATEGORIES as CATEGORIES_FILE  # noqa: E402

# Each entry: (label, [PL keywords], [EN keywords])
# Matching: ANY keyword found in lowercase product name → that category wins
_raw = json.loads(CATEGORIES_FILE.read_text("utf-8"))
CATEGORIES: list[tuple[str, list[str], list[str]]] = [
    (entry["label"], entry["keywords_pl"], entry["keywords_en"])
    for entry in _raw
]


# ── Classifier ────────────────────────────────────────────────────────────────

def _normalize(text: str) -> str:
    """Lowercase + strip Polish diacritics for comparison."""
    t = text.lower()
    for a, b in [("ą","a"),("ć","c"),("ę","e"),("ł","l"),
                 ("ń","n"),("ó","o"),("ś","s"),("ź","z"),("ż","z")]:
        t = t.replace(a, b)
    return t


# Pre-compile regex patterns for speed
_COMPILED: list[tuple[str, list[re.Pattern], list[re.Pattern]]] = []
for _label, _kw_pl, _kw_en in CATEGORIES:
    _pl = [re.compile(re.escape(_normalize(k))) for k in _kw_pl]
    _en = [re.compile(re.escape(k.lower())) for k in _kw_en]
    _COMPILED.append((_label, _pl, _en))


def classify(name: str, store_category: str = "") -> str | None:
    """
    Classify a product into one of the 12 standard categories.
    Returns the category label or None if no match.

    Args:
        name:           Product name (PL or EN)
        store_category: Original shop category (optional, helps disambiguation)
    """
    norm_name = _normalize(name)
    norm_cat  = _normalize(store_category)
    combined  = norm_name + " " + norm_cat

    for label, pl_patterns, en_patterns in _COMPILED:
        for pat in pl_patterns:
            if pat.search(combined):
                return label
        for pat in en_patterns:
            if pat.search(combined):
                return label

    return None


def classify_product(product: dict) -> dict | None:
    """
    Takes a product dict (from any scraper), classifies it,
    and adds a `standard_category` field. Returns None if no match.

    Supported formats:
      Auchan/Biedronka: {name, price, ...}
      Aldi:             {name, category, price, ...}
      MealPrepOnFleek:  {name, category, ingredients, ...}
    """
    name     = product.get("name", "")
    cat      = product.get("category", "") or product.get("_category", "")
    standard = classify(name, str(cat))

    if standard is None:
        return None

    result = dict(product)
    result["standard_category"] = standard
    return result


# ── CLI: filter a JSON product file ──────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="Classify and filter products into 12 standard categories")
    ap.add_argument("input",  help="JSON file with products (list)")
    ap.add_argument("--out",  default=None,
                    help="Output file (default: input_classified.json)")
    ap.add_argument("--stats", action="store_true",
                    help="Print stats only, skip writing output")
    ap.add_argument("--show-unmatched", action="store_true",
                    help="Print products that didn't match any category")
    args = ap.parse_args()

    path_in  = Path(args.input)
    path_out = Path(args.out) if args.out else path_in.parent / (path_in.stem + "_classified.json")

    products = json.loads(path_in.read_text("utf-8"))
    print(f"Loaded: {len(products)} products from {path_in.name}")

    matched   = []
    unmatched = []

    for p in products:
        result = classify_product(p)
        if result:
            matched.append(result)
        else:
            unmatched.append(p)

    by_cat: dict[str, int] = {}
    for p in matched:
        c = p["standard_category"]
        by_cat[c] = by_cat.get(c, 0) + 1

    print(f"\nMatched:   {len(matched)}  ({len(matched)/len(products)*100:.1f}%)")
    print(f"Unmatched: {len(unmatched)}")
    print("\nBy category:")
    for cat, count in sorted(by_cat.items(), key=lambda x: -x[1]):
        print(f"  {count:4d}  {cat}")

    if args.show_unmatched:
        print("\nUnmatched (first 30):")
        for p in unmatched[:30]:
            print(f"  {p.get('name','?')[:60]}")

    if args.stats:
        return

    path_out.write_text(json.dumps(matched, ensure_ascii=False, indent=2), "utf-8")
    print(f"\nSaved → {path_out}  ({len(matched)} products)")


if __name__ == "__main__":
    main()
