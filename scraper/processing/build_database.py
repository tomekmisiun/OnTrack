#!/usr/bin/env python3
"""
Krok 4: Buduje bazę składników i przepisów z dopasowań.
- ingredient_db_en/pl.json: składniki z dopasowaniem
- unmatched_en/pl.json: składniki bez dopasowania + top kandydaci
- recipes_en/pl.json: tylko przepisy z 100% pokryciem składników + szacowany koszt

Wejście:  data/matches_en.json, data/matches_pl.json,
          data/recipes_normalized.json,
          data/shops_en.json, data/shops_pl.json
Wyjście:  data/ingredient_db_en.json, data/ingredient_db_pl.json,
          data/unmatched_en.json, data/unmatched_pl.json,
          data/recipes_en.json, data/recipes_pl.json
"""

import json, logging
from pathlib import Path
from rapidfuzz import fuzz

HERE = Path(__file__).parent
DATA = HERE.parent / "data"

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger(__name__)


# ── Konwersja jednostek ───────────────────────────────────────────────────────

def to_base(amount, unit: str) -> tuple:
    """Normalizuje do g lub ml. Zwraca (value, base_unit)."""
    if amount is None or unit is None:
        return None, None
    u = unit.lower().strip()
    if u in ("g", "ml"):
        return float(amount), u
    if u == "kg":
        return float(amount) * 1000, "g"
    if u == "l":
        return float(amount) * 1000, "ml"
    # pcs — zostawiamy bez konwersji
    if u in ("pcs", "szt"):
        return float(amount), "pcs"
    return None, None


def calc_ingredient_cost(ing_amount, ing_unit: str, product: dict) -> float | None:
    """Koszt składnika na podstawie ilości i produktu ze sklepu."""
    pkg_val  = product.get("package_size_value")
    pkg_unit = (product.get("unit") or "").lower()
    price    = product.get("price_package")

    if not price or not pkg_val or pkg_val <= 0:
        return None

    # pcs — przelicz na sztuki
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

    # g ↔ ml: traktujemy 1:1 dla wody/bulionu/mleka
    if ing_base_unit != pkg_unit:
        # Dopuść tylko jeśli oba to masa/objętość
        if not ({ing_base_unit, pkg_unit} <= {"g", "ml"}):
            return None
        # 1:1 przeliczenie (gęstość ~1 dla wody/bulionów)

    return round(ing_base / pkg_val * price, 4)


# ── Budowanie ingredient_db ───────────────────────────────────────────────────

def build_ingredient_db(matches: list[dict]) -> dict[str, dict]:
    return {m["ingredient_name"]: m for m in matches}


# ── Budowanie unmatched ───────────────────────────────────────────────────────

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


# ── Budowanie recipes ─────────────────────────────────────────────────────────

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
                # Składnik "do smaku" — nie blokuje przepisu, ale koszt niekompletny
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


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    outputs = [
        DATA / "ingredient_db_en.json",
        DATA / "ingredient_db_pl.json",
        DATA / "unmatched_en.json",
        DATA / "unmatched_pl.json",
        DATA / "recipes_en.json",
        DATA / "recipes_pl.json",
    ]
    if all(f.exists() for f in outputs):
        log.info("Wszystkie pliki wynikowe już istnieją. Pomijam krok 4.")
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

    # Unmatched z top kandydatami
    unmatched_en = build_unmatched(unmatched_en_raw, shops_en)
    unmatched_pl = build_unmatched(unmatched_pl_raw, shops_pl)

    # Recipes
    recipes_en = build_recipes(recipes, db_en, "ingredients_en", "GBP")
    recipes_pl = build_recipes(recipes, db_pl, "ingredients_pl", "PLN")

    def save(path, data):
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), "utf-8")
        log.info(f"Zapisano {len(data)} → {path.name}")

    save(DATA / "ingredient_db_en.json", list(db_en.values()))
    save(DATA / "ingredient_db_pl.json", list(db_pl.values()))
    save(DATA / "unmatched_en.json", unmatched_en)
    save(DATA / "unmatched_pl.json", unmatched_pl)
    save(DATA / "recipes_en.json",   recipes_en)
    save(DATA / "recipes_pl.json",   recipes_pl)

    log.info(
        f"ingredient_db EN: {len(db_en)}, PL: {len(db_pl)} | "
        f"unmatched EN: {len(unmatched_en)}, PL: {len(unmatched_pl)} | "
        f"recipes EN: {len(recipes_en)}/{len(recipes)}, "
        f"PL: {len(recipes_pl)}/{len(recipes)}"
    )


if __name__ == "__main__":
    main()
