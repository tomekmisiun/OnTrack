"""
Step 6: Generate products_seed_*.json and recipes_seed_*.json for new users.
Run as part of the pipeline or standalone: python processing/dump_seeds.py
"""
import json
from pathlib import Path

DATA = Path(__file__).parent.parent / "data"
OUT  = Path(__file__).parent.parent.parent / "app" / "data"


def load(fname):
    with open(DATA / fname, encoding="utf-8") as f:
        return json.load(f)


def resolve_price(item: dict) -> tuple[float, str, float, bool]:
    unit_raw = item.get("unit") or "g"
    unit = "szt" if unit_raw == "pcs" else unit_raw
    pkg_val = float(item.get("package_size_value") or (1.0 if unit == "szt" else 100.0))
    sold_by_wt = bool(item.get("sold_by_weight", False))
    price_per_100 = item.get("price_per_100")
    price_package = item.get("price_package")
    if price_per_100 is not None:
        return round(float(price_per_100), 4), unit, round(pkg_val, 1), sold_by_wt
    if price_package and pkg_val > 0:
        if unit == "szt":
            return round(float(price_package) / pkg_val, 4), unit, round(pkg_val, 1), sold_by_wt
        return round(float(price_package) / pkg_val * 100, 4), unit, round(pkg_val, 1), sold_by_wt
    return 0.0, unit, round(pkg_val, 1), sold_by_wt


def macro_for_item(item: dict, macros: dict) -> dict:
    ing = item["ingredient_name"].strip()
    generic = (item.get("generic_name") or ing).strip()
    for key in (ing.lower(), generic.lower()):
        hit = macros.get(key)
        if hit:
            return hit
    return {}


def _unavailable_ingredients(lang: str) -> set[str]:
    path = DATA / "ingredient_aliases.json"
    if not path.exists():
        return set()
    aliases = json.loads(path.read_text("utf-8")).get(lang, {})
    return {name for name, alias in aliases.items() if alias.endswith(" nomatch")}


def build_products_seed(lang: str) -> list[dict]:
    db_file = f"ingredient_db_{lang}.json"
    macro_key = "name_en" if lang == "en" else "name_pl"
    unavailable = _unavailable_ingredients(lang)
    ingredient_db = [
        item for item in load(db_file)
        if item["ingredient_name"] not in unavailable
    ]
    macros_list = load("ingredients_macros.json")

    macros = {}
    for m in macros_list:
        for field in (macro_key, "name_en", "name_pl"):
            key = (m.get(field) or "").lower().strip()
            if key:
                macros[key] = m

    seen_names = set()
    products_seed = []
    for item in ingredient_db:
        name = item["ingredient_name"].strip()
        key = name.lower()
        if key in seen_names:
            continue
        seen_names.add(key)

        unit_price, unit, pkg_val, sold_by_wt = resolve_price(item)
        macro = macro_for_item(item, macros)
        products_seed.append({
            "name": name,
            "price": unit_price,
            "package_weight": pkg_val,
            "unit": unit,
            "sold_by_weight": sold_by_wt,
            "kcal": macro.get("kcal"),
            "protein": macro.get("protein_g"),
            "fat": macro.get("fat_g"),
            "carbs": macro.get("carbs_g"),
        })
    products_seed.sort(key=lambda x: x["name"].lower())
    return products_seed


def build_recipes_seed(lang: str) -> list[dict]:
    recipes_file = f"recipes_{lang}.json"
    name_key = "name_en" if lang == "en" else "name_pl"
    ing_key = "ingredients_en" if lang == "en" else "ingredients_pl"
    unavailable = _unavailable_ingredients(lang)
    recipes_raw = load(recipes_file)

    recipes_seed = []
    for r in recipes_raw:
        if not r.get("available"):
            continue
        if unavailable and any(
            (ing.get("name") or "") in unavailable for ing in r.get(ing_key, [])
        ):
            continue
        ingredients_out = []
        for ing in r.get(ing_key, []):
            ingredients_out.append({
                "product_name": ing["name"],
                "weight": float(ing.get("amount") or 0),
            })
        raw_cat = r.get("category") or ""
        category = {"snacks": "snack", "desserts": "dessert"}.get(raw_cat, raw_cat) or None
        recipes_seed.append({
            "name": r[name_key],
            "name_en": r.get("name_en") if lang == "pl" else None,
            "source_url": r.get("url"),
            "image_url": None,
            "category": category,
            "notes": None,
            "ingredients": ingredients_out,
        })
    return recipes_seed


OUT.mkdir(parents=True, exist_ok=True)

all_products = {}
all_recipes = {}
for lang in ("en", "pl"):
    try:
        products_seed = build_products_seed(lang)
        recipes_seed = build_recipes_seed(lang)
    except FileNotFoundError as e:
        print(f"Skip {lang}: {e}")
        continue
    all_products[lang] = products_seed
    all_recipes[lang] = recipes_seed
    print(f"Products {lang.upper()}: {len(products_seed)}")
    print(f"Recipes {lang.upper()}: {len(recipes_seed)}")
    with open(OUT / f"products_seed_{lang}.json", "w", encoding="utf-8") as f:
        json.dump(products_seed, f, ensure_ascii=False, indent=2)
    with open(OUT / f"recipes_seed_{lang}.json", "w", encoding="utf-8") as f:
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

    sections = [{
        "title": "Seed data stats",
        "stats": {
            **{f"Products seed {l.upper()}": len(all_products[l]) for l in all_products},
            **{f"Recipes seed {l.upper()}": len(all_recipes[l]) for l in all_recipes},
        },
        "rows": [],
    }]
    for lang, products_seed in all_products.items():
        sections.append({
            "title": f"Products seed {lang.upper()}",
            "rows": [prod_row(p) for p in products_seed],
        })
    for lang, recipes_seed in all_recipes.items():
        sections.append({
            "title": f"Recipes seed {lang.upper()}",
            "rows": [recipe_row(r) for r in recipes_seed],
        })
    write_report(6, "dump_seeds", sections)


_write_debug()
