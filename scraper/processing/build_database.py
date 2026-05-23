#!/usr/bin/env python3
"""
Step 4: Builds ingredient database and recipe list from matches.
- ingredient_db_en/pl.json: matched ingredients
- recipes_en/pl.json: recipes with 100% ingredient coverage + estimated cost
- debugging/step4_build_database.txt: unmatched ingredients with top candidates

Input:  data/matches_en.json, data/matches_pl.json,
        data/recipes_normalized.json,
        data/shops_en.json, data/shops_pl.json
Output: data/ingredient_db_en.json, data/ingredient_db_pl.json,
        data/recipes_en.json, data/recipes_pl.json
"""

import json, logging
from pathlib import Path
from rapidfuzz import fuzz

HERE = Path(__file__).parent
DATA = HERE.parent / "data"

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger(__name__)


# ── Unit conversion ──────────────────────────────────────────────────────────

def to_base(amount, unit: str) -> tuple:
    """Normalize to g or ml. Returns (value, base_unit)."""
    if amount is None or unit is None:
        return None, None
    u = unit.lower().strip()
    if u in ("g", "ml"):
        return float(amount), u
    if u == "kg":
        return float(amount) * 1000, "g"
    if u == "l":
        return float(amount) * 1000, "ml"
    # pcs — no conversion
    if u in ("pcs", "szt"):
        return float(amount), "pcs"
    return None, None


def calc_ingredient_cost(ing_amount, ing_unit: str, product: dict) -> float | None:
    """Ingredient cost based on quantity and shop product."""
    pkg_val  = product.get("package_size_value")
    pkg_unit = (product.get("unit") or "").lower()
    price    = product.get("price_package")

    if not price or not pkg_val or pkg_val <= 0:
        return None

    # pcs — convert by count
    if pkg_unit == "pcs":
        if ing_unit not in ("pcs", "szt", None):
            return None
        if ing_amount is None:
            return None
        return round(ing_amount / pkg_val * price, 4)

    # g lub ml
    ing_base, ing_base_unit = to_base(ing_amount, ing_unit)
    if ing_base is None:
        return None

    # g ↔ ml: treat 1:1 for water/stock/milk
    if ing_base_unit != pkg_unit:
        # Allow only if both are mass/volume
        if not ({ing_base_unit, pkg_unit} <= {"g", "ml"}):
            return None
        # 1:1 conversion (density ~1 for water/broths)

    return round(ing_base / pkg_val * price, 4)


# ── Building ingredient_db ────────────────────────────────────────────────────

def build_ingredient_db(matches: list[dict]) -> dict[str, dict]:
    return {m["ingredient_name"]: m for m in matches}


# ── Building unmatched list ───────────────────────────────────────────────────

def build_unmatched(
    unmatched_raw: list[str],
    shops: list[dict],
    top_n: int = 5,
) -> list[dict]:
    results = []
    for ing in unmatched_raw:
        candidates = []
        for p in shops:
            s = max(
                fuzz.token_sort_ratio(ing, p["generic_name"]),
                fuzz.partial_ratio(ing, p["generic_name"]),
            )
            candidates.append({"product": p["generic_name"], "score": round(s, 1)})
        candidates.sort(key=lambda x: -x["score"])
        results.append({"ingredient_name": ing, "top_candidates": candidates[:top_n]})
    return results


# ── Building recipes ─────────────────────────────────────────────────────────

def build_recipes(
    recipes: list[dict],
    db: dict[str, dict],
    ing_key: str,   # "ingredients_en" or "ingredients_pl"
    currency: str,
) -> list[dict]:
    output = []
    for r in recipes:
        ings        = r.get(ing_key, [])
        available   = True
        total_cost  = 0.0
        cost_complete = True

        for ing in ings:
            name   = ing.get("name")
            amount = ing.get("amount")
            unit   = ing.get("unit")

            if amount is None:
                # "to taste" ingredient — doesn't block the recipe but cost is incomplete
                cost_complete = False
                continue

            if not name or name not in db:
                available = False
                break

            product = db[name]
            cost    = calc_ingredient_cost(amount, unit, product)
            if cost is None:
                cost_complete = False
            else:
                total_cost += cost

        if not available:
            continue

        # Reject recipes with no ingredient that has a weight (all "to taste" spices)
        matched_with_amount = sum(
            1 for i in ings
            if i.get("amount") is not None and i.get("name") in db
        )
        if matched_with_amount == 0:
            continue

        output.append({
            "name_en":          r.get("name_en"),
            "name_pl":          r.get("name_pl"),
            "url":              r.get("url"),
            "image_url":        r.get("image_url"),
            "category":         r.get("category"),
            "ingredients_en":   r.get("ingredients_en", []),
            "ingredients_pl":   r.get("ingredients_pl", []),
            "available":        True,
            f"estimated_cost_{currency.lower()}": round(total_cost, 2) if cost_complete else None,
            "cost_complete":    cost_complete,
        })

    return output


# ── Debug report ──────────────────────────────────────────────────────────────

def _write_debug(db_en, db_pl, unmatched_en, unmatched_pl,
                 recipes_en, recipes_pl, total_recipes):
    from debug_writer import write_report

    def db_row(name, m):
        price = m.get("price_per_100")
        return (f"{name:<35} → {m.get('original_name', ''):<50} "
                f"| {m.get('shop', ''):<12} | {price if price is not None else '—'}")

    def unmatch_row(u):
        top = u.get("top_candidates", [])[:3]
        top_str = ", ".join(f"{c['product']}({c['score']})" for c in top)
        return f"{u['ingredient_name']:<35} | top: {top_str}"

    def recipe_row_en(r):
        cost = r.get("estimated_cost_gbp")
        n_ing = len(r.get("ingredients_en", []))
        return f"{r.get('name_en', ''):<55} | {n_ing} ing. | cost={cost if cost is not None else '—'}"

    def recipe_row_pl(r):
        cost = r.get("estimated_cost_pln")
        n_ing = len(r.get("ingredients_pl", []))
        return f"{r.get('name_pl', ''):<55} | {n_ing} ing. | cost={cost if cost is not None else '—'}"

    sections = [
        {
            "title": "Database build stats",
            "stats": {
                "Ingredient DB EN":               len(db_en),
                "Ingredient DB PL":               len(db_pl),
                "Unmatched EN":                   len(unmatched_en),
                "Unmatched PL":                   len(unmatched_pl),
                "Input recipes":                  total_recipes,
                "Recipes EN (100% coverage)":     len(recipes_en),
                "Recipes PL (100% coverage)":     len(recipes_pl),
                "% accepted EN":                  f"{len(recipes_en)/max(1,total_recipes)*100:.1f}%",
                "% accepted PL":                  f"{len(recipes_pl)/max(1,total_recipes)*100:.1f}%",
                "EN with full cost":              sum(1 for r in recipes_en if r.get("cost_complete")),
                "PL with full cost":              sum(1 for r in recipes_pl if r.get("cost_complete")),
            },
            "rows": [],
        },
        {
            "title": "EN ingredient_db (ingredient_name → original_name | shop | price_per_100)",
            "rows": [db_row(k, v) for k, v in sorted(db_en.items())],
        },
        {
            "title": "EN — unmatched ingredients (top 3 candidates)",
            "rows": [unmatch_row(u) for u in sorted(unmatched_en, key=lambda x: x["ingredient_name"])],
        },
        {
            "title": "PL ingredient_db (ingredient_name → original_name | shop | price_per_100)",
            "rows": [db_row(k, v) for k, v in sorted(db_pl.items())],
        },
        {
            "title": "PL — unmatched ingredients (top 3 candidates)",
            "rows": [unmatch_row(u) for u in sorted(unmatched_pl, key=lambda x: x["ingredient_name"])],
        },
        {
            "title": "EN — accepted recipes (name | n_ing | cost GBP)",
            "rows": [recipe_row_en(r) for r in sorted(recipes_en, key=lambda x: x.get("name_en", ""))],
        },
        {
            "title": "PL — accepted recipes (name | n_ing | cost PLN)",
            "rows": [recipe_row_pl(r) for r in sorted(recipes_pl, key=lambda x: x.get("name_pl", ""))],
        },
    ]
    write_report(4, "build_database", sections)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    outputs = [
        DATA / "ingredient_db_en.json",
        DATA / "ingredient_db_pl.json",
        DATA / "recipes_en.json",
        DATA / "recipes_pl.json",
    ]
    if all(f.exists() for f in outputs):
        log.info("All output files already exist. Skipping step 4.")
        return

    matches_en = json.loads((DATA / "matches_en.json").read_text("utf-8"))
    matches_pl = json.loads((DATA / "matches_pl.json").read_text("utf-8"))
    recipes    = json.loads((DATA / "recipes_normalized.json").read_text("utf-8"))
    shops_en   = json.loads((DATA / "shops_en.json").read_text("utf-8"))
    shops_pl   = json.loads((DATA / "shops_pl.json").read_text("utf-8"))

    unmatched_en_raw_f = DATA / "unmatched_en_raw.json"
    unmatched_pl_raw_f = DATA / "unmatched_pl_raw.json"
    unmatched_en_raw = json.loads(unmatched_en_raw_f.read_text("utf-8")) if unmatched_en_raw_f.exists() else []
    unmatched_pl_raw = json.loads(unmatched_pl_raw_f.read_text("utf-8")) if unmatched_pl_raw_f.exists() else []

    # Ingredient databases
    db_en = build_ingredient_db(matches_en)
    db_pl = build_ingredient_db(matches_pl)

    # Unmatched with top candidates
    unmatched_en = build_unmatched(unmatched_en_raw, shops_en)
    unmatched_pl = build_unmatched(unmatched_pl_raw, shops_pl)

    # Recipes
    recipes_en = build_recipes(recipes, db_en, "ingredients_en", "GBP")
    recipes_pl = build_recipes(recipes, db_pl, "ingredients_pl", "PLN")

    def save(path, data):
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), "utf-8")
        log.info(f"Saved {len(data)} → {path.name}")

    save(DATA / "ingredient_db_en.json", list(db_en.values()))
    save(DATA / "ingredient_db_pl.json", list(db_pl.values()))
    save(DATA / "recipes_en.json",   recipes_en)
    save(DATA / "recipes_pl.json",   recipes_pl)

    log.info(
        f"ingredient_db EN: {len(db_en)}, PL: {len(db_pl)} | "
        f"unmatched EN: {len(unmatched_en)}, PL: {len(unmatched_pl)} | "
        f"recipes EN: {len(recipes_en)}/{len(recipes)}, "
        f"PL: {len(recipes_pl)}/{len(recipes)}"
    )

    _write_debug(db_en, db_pl, unmatched_en, unmatched_pl,
                 recipes_en, recipes_pl, len(recipes))


if __name__ == "__main__":
    main()
