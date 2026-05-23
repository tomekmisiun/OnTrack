"""
Step 6: Generate products_seed_en.json and recipes_seed_en.json for new EN users.
Run as part of the pipeline or standalone: python processing/dump_seeds.py
"""
import json
from pathlib import Path

DATA = Path(__file__).parent.parent / "data"         # scraper/data
OUT  = Path(__file__).parent.parent.parent / "app" / "data"  # app/data

def load(fname):
    with open(DATA / fname, encoding="utf-8") as f:
        return json.load(f)

ingredient_db  = load("ingredient_db_en.json")   # list of matched products
macros_list    = load("ingredients_macros.json")  # list with name_en, kcal, protein_g, fat_g, carbs_g
recipes_en     = load("recipes_en.json")          # list of EN recipes

# ── macros lookup: name_en (lower) → macro dict ────────────────────────
macros = {}
for m in macros_list:
    key = m["name_en"].lower().strip()
    macros[key] = m

# ── products seed ─────────────────────────────────────────────────────
seen_names = set()
products_seed = []

for item in ingredient_db:
    name = item["ingredient_name"].strip()
    key  = name.lower()
    if key in seen_names:
        continue
    seen_names.add(key)

    macro = macros.get(key, {})
    products_seed.append({
        "name": name,
        "price": round(item.get("price_per_100") or 0, 4),
        "package_weight": item.get("package_size_value") or 100.0,
        "unit": item.get("unit") or "g",
        "sold_by_weight": bool(item.get("sold_by_weight", False)),
        "kcal": macro.get("kcal"),
        "protein": macro.get("protein_g"),
        "fat": macro.get("fat_g"),
        "carbs": macro.get("carbs_g"),
    })

products_seed.sort(key=lambda x: x["name"].lower())
print(f"Products EN: {len(products_seed)}")

# ── recipes seed ──────────────────────────────────────────────────────
recipes_seed = []

for r in recipes_en:
    if not r.get("available"):
        continue
    ingredients_out = []
    for ing in r.get("ingredients_en", []):
        unit = ing.get("unit", "g")
        # convert tablespoon/teaspoon/cup to grams roughly
        unit_map = {"tablespoon": "g", "teaspoon": "g", "cup": "g", "pinch": "g"}
        unit = unit_map.get(unit, unit)
        ingredients_out.append({
            "product_name": ing["name"],
            "weight": float(ing.get("amount") or 0),
        })
    recipes_seed.append({
        "name": r["name_en"],
        "source_url": r.get("url"),
        "image_url": r.get("image_url"),
        "category": r.get("category"),
        "notes": None,
        "ingredients": ingredients_out,
    })

print(f"Recipes EN: {len(recipes_seed)}")

# ── write ──────────────────────────────────────────────────────────────
OUT.mkdir(parents=True, exist_ok=True)

with open(OUT / "products_seed_en.json", "w", encoding="utf-8") as f:
    json.dump(products_seed, f, ensure_ascii=False, indent=2)

with open(OUT / "recipes_seed_en.json", "w", encoding="utf-8") as f:
    json.dump(recipes_seed, f, ensure_ascii=False, indent=2)

print(f"Written to {OUT}")


def _write_debug():
    from debug_writer import write_report

    def prod_row(p):
        return (
            f"{p['name']:<35} | price={str(p['price']):<8} | "
            f"kcal={str(p.get('kcal') or '?'):<6} prot={str(p.get('protein') or '?'):<5} "
            f"fat={str(p.get('fat') or '?'):<5} carb={p.get('carbs') or '?'}"
        )

    def recipe_row(r):
        return f"{r['name']:<55} | {len(r['ingredients'])} ing."

    sections = [
        {
            "title": "Seed data stats",
            "stats": {
                "Products seed EN":          len(products_seed),
                "Recipes seed EN":           len(recipes_seed),
                "Products with price > 0":   sum(1 for p in products_seed if p["price"] > 0),
                "Products with macros":      sum(1 for p in products_seed if p.get("kcal") is not None),
                "Recipes with URL":          sum(1 for r in recipes_seed if r.get("source_url")),
            },
            "rows": [],
        },
        {
            "title": "Products seed EN (name | price_per_100 | kcal | protein | fat | carbs)",
            "rows": [prod_row(p) for p in products_seed],
        },
        {
            "title": "Recipes seed EN (name | n_ingredients)",
            "rows": [recipe_row(r) for r in recipes_seed],
        },
    ]
    write_report(6, "dump_seeds", sections)


_write_debug()
