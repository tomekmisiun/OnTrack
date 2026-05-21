#!/usr/bin/env python3
"""
Krok 3: Dopasowuje składniki przepisów do produktów sklepowych.
- rapidfuzz pre-filter: >= 85 → MATCH_AUTO, 55-84 → UNCERTAIN, < 55 → NO_MATCH
- DeepSeek dla UNCERTAIN (batch po 15)

Wejście:  data/recipes_normalized.json, data/shops_en.json, data/shops_pl.json
Wyjście:  data/matches_en.json, data/matches_pl.json
"""

import os, sys, json, re, time, logging
from pathlib import Path
from collections import defaultdict

try:
    from rapidfuzz import fuzz
except ImportError:
    print("Brak rapidfuzz. Zainstaluj: pip install rapidfuzz"); sys.exit(1)

try:
    from openai import OpenAI
except ImportError:
    print("Brak openai. Zainstaluj: pip install openai"); sys.exit(1)

HERE = Path(__file__).parent
DATA = HERE.parent / "data"

RECIPES_FILE = DATA / "recipes_normalized.json"
SHOPS_EN     = DATA / "shops_en.json"
SHOPS_PL     = DATA / "shops_pl.json"
OUT_EN       = DATA / "matches_en.json"
OUT_PL       = DATA / "matches_pl.json"

SCORE_AUTO      = 85
SCORE_UNCERTAIN = 100  # WYŁĄCZONE — tylko exacty/bliskie >= 85% przechodzą, reszta = NO_MATCH
UNCERTAIN_BATCH = 15
MAX_CANDIDATES  = 10
MAX_RETRIES     = 2

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger(__name__)


# ── Scoring ───────────────────────────────────────────────────────────────────

def score(ingredient: str, product_generic: str) -> float:
    return max(
        fuzz.token_sort_ratio(ingredient, product_generic),
        fuzz.partial_ratio(ingredient, product_generic),
    )


def rank_candidates(ingredient: str, shop_products: list[dict]) -> list[tuple[float, dict]]:
    scored = [(score(ingredient, p["generic_name"]), p) for p in shop_products]
    scored.sort(key=lambda x: -x[0])
    return scored


# ── DeepSeek matching dla UNCERTAIN ──────────────────────────────────────────

MATCH_SYSTEM = """\
You are a culinary product matcher. For each ingredient decide which shop products
are a valid match — meaning a cook COULD substitute this shop product for this
ingredient in the recipe.

STRICT CATEGORY RULES — these violations are NEVER acceptable:
- A MEAT product NEVER matches a spice/seasoning/sauce ingredient
- A DAIRY product NEVER matches a vegetable/fruit/grain ingredient
- A PREPARED/PROCESSED product NEVER matches a raw ingredient
- A FLAVORED/BRANDED SNACK never matches a plain ingredient
  (e.g. "carmelove orzeszki" != "orzeszki ziemne", "serek z jalapeno" != "jalapeño")

IF IN DOUBT → return empty array []. Better to have no match than a wrong match.

Other matching rules:
- Flavor variants NEVER match plain: "strawberry yogurt" != "plain yogurt"
- Dairy-free is separate: "dairy free yogurt" != "plain yogurt"
- Fat% never matters: "2% greek yogurt" matches "greek yogurt"
- Meat form matters: "chicken breast" != "chicken thighs" != "ground chicken"
- Smoked salmon IS a valid match for "salmon"
- Frozen version matches fresh: "frozen blueberries" matches "blueberries"
- Ready-to-eat products never match raw ingredients
- Spice variants ok if base ingredient matches: "hot paprika" matches "paprika"

Return ONLY valid JSON array, no markdown:
[{"ingredient": "ingredient name", "match_indices": [0, 2]}]
Empty array [] if nothing matches.
"""


def get_client():
    key = os.environ.get("DEEPSEEK_API_KEY")
    if not key:
        raise RuntimeError("DEEPSEEK_API_KEY nie ustawiony")
    return OpenAI(api_key=key, base_url="https://api.deepseek.com")


def deepseek_match(client, batch: list[dict]) -> dict[str, list[int]]:
    """
    batch = [{"ingredient": str, "candidates": [{"idx": int, "product": str}]}]
    Zwraca {ingredient_name: [matching_idx, ...]}
    """
    payload = json.dumps(batch, ensure_ascii=False)
    last_err = None

    for attempt in range(MAX_RETRIES + 1):
        try:
            resp = client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": MATCH_SYSTEM},
                    {"role": "user",   "content": payload},
                ],
                temperature=0.0,
            )
            content = resp.choices[0].message.content.strip()
            content = re.sub(r"^```(?:json)?\s*", "", content)
            content = re.sub(r"\s*```$", "", content)
            results = json.loads(content)
            return {r["ingredient"]: r["match_indices"] for r in results}
        except Exception as e:
            last_err = e
            if "429" in str(e) or "rate" in str(e).lower():
                log.warning("Rate limit — czekam 10s")
                time.sleep(10)
            elif attempt < MAX_RETRIES:
                time.sleep(2)

    log.error(f"DeepSeek batch nieudany: {last_err}")
    return {}


# ── Budowanie dopasowań ───────────────────────────────────────────────────────

def build_matches(
    unique_ingredients: list[str],
    shops: list[dict],
    lang: str,
    client,
) -> list[dict]:
    log.info(f"[{lang}] Dopasowuję {len(unique_ingredients)} składników do {len(shops)} produktów")

    # Etap 1: rapidfuzz pre-filter
    auto_matches:    dict[str, dict] = {}
    uncertain_items: list[dict]      = []
    no_match:        list[str]       = []

    for ing in unique_ingredients:
        ranked = rank_candidates(ing, shops)
        top_score, top_product = ranked[0] if ranked else (0, None)

        if top_score >= SCORE_AUTO:
            auto_matches[ing] = (top_score, top_product)
        elif top_score >= SCORE_UNCERTAIN:
            candidates = [
                {"idx": i, "product": ranked[i][1]["generic_name"]}
                for i in range(min(MAX_CANDIDATES, len(ranked)))
                if ranked[i][0] >= SCORE_UNCERTAIN
            ]
            uncertain_items.append({"ingredient": ing, "candidates": candidates, "_ranked": ranked})
        else:
            no_match.append(ing)

    log.info(f"[{lang}] Auto: {len(auto_matches)}, Uncertain: {len(uncertain_items)}, No match: {len(no_match)}")

    # Etap 2: DeepSeek dla UNCERTAIN
    ai_matches: dict[str, list[int]] = {}
    for i in range(0, len(uncertain_items), UNCERTAIN_BATCH):
        batch_items = uncertain_items[i:i + UNCERTAIN_BATCH]
        batch_payload = [{"ingredient": x["ingredient"], "candidates": x["candidates"]} for x in batch_items]
        result = deepseek_match(client, batch_payload)
        ai_matches.update(result)
        log.info(f"[{lang}] AI batch {i//UNCERTAIN_BATCH + 1}/{(len(uncertain_items)-1)//UNCERTAIN_BATCH + 1}: "
                 f"{len(result)} dopasowań")
        time.sleep(0.5)

    # Etap 3: Zbierz wyniki
    # Dla auto: najlepsza z pre-filter
    matches = []

    for ing, (top_score, top_product) in auto_matches.items():
        matches.append(_build_match_record(ing, top_product, "auto", top_score))

    for item in uncertain_items:
        ing     = item["ingredient"]
        ranked  = item["_ranked"]
        indices = ai_matches.get(ing, [])
        if not indices:
            # No AI match → treat as no match
            no_match.append(ing)
            continue
        # Pick cheapest from AI-matched products
        ai_products = [ranked[idx][1] for idx in indices if idx < len(ranked)]
        ai_products = [p for p in ai_products if p is not None]
        if not ai_products:
            no_match.append(ing)
            continue
        best = _pick_cheapest(ai_products)
        ai_score = max(ranked[idx][0] for idx in indices if idx < len(ranked))
        matches.append(_build_match_record(ing, best, "ai", ai_score))

    log.info(f"[{lang}] Wynik: {len(matches)} dopasowań, {len(no_match)} bez dopasowania")
    return matches, no_match


def _build_match_record(ingredient: str, product: dict, match_type: str, fscore: float) -> dict:
    return {
        "ingredient_name":    ingredient,
        "match_type":         match_type,
        "fuzzy_score":        round(float(fscore), 1),
        "shop":               product["shop"],
        "original_name":      product["original_name"],
        "generic_name":       product["generic_name"],
        "package_size_value": product.get("package_size_value"),
        "unit":               product.get("unit"),
        "sold_by_weight":     product.get("sold_by_weight", False),
        "price_package":      product.get("price_package"),
        "price_per_unit":     product.get("price_per_unit"),
        "price_per_100":      product.get("price_per_100"),
        "currency":           product.get("currency"),
    }


def _pick_cheapest(products: list[dict]) -> dict:
    def key(p):
        if p.get("price_per_100") is not None:
            return (0, p["price_per_100"])
        if p.get("price_per_unit") is not None:
            return (1, p["price_per_unit"])
        return (2, 0)
    return min(products, key=key)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    if OUT_EN.exists() and OUT_PL.exists():
        log.info("Pliki wynikowe już istnieją. Pomijam krok 3.")
        return

    recipes = json.loads(RECIPES_FILE.read_text("utf-8"))
    shops_en = json.loads(SHOPS_EN.read_text("utf-8"))
    shops_pl = json.loads(SHOPS_PL.read_text("utf-8"))

    # Zbierz unikalne składniki
    unique_en: set[str] = set()
    unique_pl: set[str] = set()
    for r in recipes:
        for ing in r.get("ingredients_en", []):
            if ing.get("name"):
                unique_en.add(ing["name"])
        for ing in r.get("ingredients_pl", []):
            if ing.get("name"):
                unique_pl.add(ing["name"])

    log.info(f"Unikalne składniki EN: {len(unique_en)}, PL: {len(unique_pl)}")

    client = get_client()

    # EN path
    if not OUT_EN.exists():
        matches_en, unmatched_en = build_matches(sorted(unique_en), shops_en, "EN", client)
        OUT_EN.write_text(json.dumps(matches_en, ensure_ascii=False, indent=2), "utf-8")
        (DATA / "unmatched_en_raw.json").write_text(
            json.dumps(unmatched_en, ensure_ascii=False, indent=2), "utf-8"
        )
        log.info(f"matches_en: {len(matches_en)} → {OUT_EN}")

    # PL path
    if not OUT_PL.exists():
        matches_pl, unmatched_pl = build_matches(sorted(unique_pl), shops_pl, "PL", client)
        OUT_PL.write_text(json.dumps(matches_pl, ensure_ascii=False, indent=2), "utf-8")
        (DATA / "unmatched_pl_raw.json").write_text(
            json.dumps(unmatched_pl, ensure_ascii=False, indent=2), "utf-8"
        )
        log.info(f"matches_pl: {len(matches_pl)} → {OUT_PL}")


if __name__ == "__main__":
    main()
