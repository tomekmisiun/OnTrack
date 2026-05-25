#!/usr/bin/env python3
"""
Step 3: Match recipe ingredients to shop products.
- rapidfuzz pre-filter: >= 85 → MATCH_AUTO, 55-84 → UNCERTAIN, < 55 → NO_MATCH
- DeepSeek handles UNCERTAIN cases in batches of 15

Input:  data/recipes_normalized.json, data/shops_en.json, data/shops_pl.json
Output: data/matches_en.json, data/matches_pl.json

Ingredient aliases (canonical name mappings) are defined in:
    scraper/data/reference/ingredient_aliases.json  ← edit this file to fix bad matches
"""

import os, sys, json, re, time, logging
from pathlib import Path
from collections import defaultdict

try:
    from rapidfuzz import fuzz
except ImportError:
    print("Missing rapidfuzz. Install: pip install rapidfuzz"); sys.exit(1)

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

HERE = Path(__file__).parent
SCRAPER_ROOT = HERE.parent
sys.path.insert(0, str(SCRAPER_ROOT))
from data_paths import (  # noqa: E402
    INGREDIENT_ALIASES,
    MATCHES_EN,
    MATCHES_PL,
    RECIPES_NORMALIZED,
    SHOPS_EN,
    SHOPS_PL,
    UNMATCHED_EN_RAW,
    UNMATCHED_PL_RAW,
)

RECIPES_FILE = RECIPES_NORMALIZED
OUT_EN       = MATCHES_EN
OUT_PL       = MATCHES_PL

_aliases = json.loads(INGREDIENT_ALIASES.read_text("utf-8"))
_INGREDIENT_CANONICAL_PL: dict[str, str] = _aliases["pl"]
_INGREDIENT_CANONICAL_EN: dict[str, str] = _aliases["en"]

SCORE_AUTO      = 85
SCORE_UNCERTAIN = 100  # Disabled — only exact/close matches >= 85% pass, rest = NO_MATCH
UNCERTAIN_BATCH = 15
MAX_CANDIDATES  = 10
MAX_RETRIES     = 2

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger(__name__)


# ── Scoring ───────────────────────────────────────────────────────────────────

# Dietary qualifiers — vegan product ≠ regular product (when ingredient doesn't specify vegan)
_DIETARY_QUALIFIERS = {"wegański", "wegańska", "wegańskie", "vegan"}


# Stop-words ignored when comparing ingredient vs product specificity
_TOKEN_SKIP = {"do", "na", "z", "i", "w", "o", "ze", "od", "po"}

# Shop labels too vague to match multi-word ingredients (e.g. "mieszanka do coleslaw" → "mieszanka")
_GENERIC_STANDALONE = {
    "mieszanka", "przyprawa", "sos", "dodatki", "mix", "seasoning", "sauce", "dressing",
}

# Plain ingredient names must not match a more specific flavoured product
_PLAIN_BASES = {"pieprz", "sól", "sol", "sos", "przyprawa", "cukier", "mleko"}


def _meaningful_tokens(text: str) -> set[str]:
    return {t for t in text.lower().split() if len(t) > 1 and t not in _TOKEN_SKIP}


def score(ingredient: str, product_generic: str) -> float:
    tsr = fuzz.token_sort_ratio(ingredient, product_generic)
    pr  = fuzz.partial_ratio(ingredient, product_generic)

    tokens_i = ingredient.lower().split()
    tokens_p = product_generic.lower().split()
    meaningful_i = {t for t in tokens_i if len(t) > 1}
    meaningful_p = {t for t in tokens_p if len(t) > 1}
    has_common_token = bool(meaningful_i & meaningful_p)

    if not has_common_token:
        return tsr   # "proszek" ≠ "groszek"

    # Processed form of product ≠ raw ingredient:
    # "apricot jam" ≠ "apricot", "apple sauce" ≠ "apple" (as raw fruit)
    _PROCESSED_FORMS = {"jam", "jelly", "sauce", "preserve", "preserves", "conserve",
                        "conserves", "paste", "extract", "syrup", "concentrate",
                        "puree", "purée", "compote", "curd",
                        "yogurt", "yoghurt"}  # coconut sugar ≠ coconut yogurt
    if (meaningful_p & _PROCESSED_FORMS) and not (meaningful_i & _PROCESSED_FORMS):
        return tsr  # product is a processed form, ingredient is raw

    # Dietary qualifier mismatch: "vegan mayonnaise" ≠ "mayonnaise"
    diet_p = meaningful_p & _DIETARY_QUALIFIERS
    diet_i = meaningful_i & _DIETARY_QUALIFIERS
    if diet_p and not diet_i:
        return tsr  # product has qualifier, ingredient doesn't — don't match

    # Ingredient leads product name vs. appears as a flavor/qualifier
    first_product_token = next((t for t in tokens_p if len(t) > 1), "")
    ingredient_leads = first_product_token in meaningful_i

    if pr >= 85 and not ingredient_leads and tsr < 77:
        return tsr   # "jagoda" inside "jogurt jagoda", "mak" inside "jogurt mak marcepan"

    # 2→1 rule: if ingredient has 2 tokens and product has only 1,
    # and no other ingredient token appears in the product,
    # and TSR is low → likely false positive from a shared word.
    # Only applied for very low TSR (< 50) to avoid blocking normal cases.
    if ingredient_leads and len(meaningful_i) >= 2 and len(meaningful_p) == 1:
        non_leading_i = meaningful_i - {first_product_token}
        if non_leading_i and not (non_leading_i & meaningful_p) and tsr < 50:
            return tsr  # e.g. "serca karczochów"→"serca" (tsr≈48)

    base = max(tsr, pr)
    ing_l = ingredient.lower().strip()
    prod_l = product_generic.lower().strip()
    mt_i = _meaningful_tokens(ingredient)
    mt_p = _meaningful_tokens(product_generic)

    # "przyprawa cajun" must not match generic shop label "przyprawa"
    if prod_l in _GENERIC_STANDALONE and ing_l != prod_l:
        return min(base, tsr, 50)

    if len(mt_p) == 1:
        token = next(iter(mt_p))
        if token in _GENERIC_STANDALONE and mt_i - {token}:
            return min(base, tsr, 50)

    # Plain "pieprz" must not match "pieprz czosnkowy"
    if ing_l in _PLAIN_BASES and len(mt_p) > len(mt_i):
        return min(base, tsr, 50)

    if ing_l == "pieprz":
        extra = mt_p - {"pieprz", "czarny", "mielony", "ziarnisty"}
        if extra & {"czosnkowy", "cytrynowy", "cayenne", "kolorowy", "ziołowy", "zielony"}:
            return min(base, tsr, 50)

    if ing_l in {"sól", "sol"}:
        extra = mt_p - {"sól", "sol", "jodowana", "niejodowana", "drobnoziarnista"}
        if extra:
            return min(base, tsr, 50)

    # "kawa" in recipes = brewed coffee; not iced coffee drinks ("kawa mrożona")
    if ing_l == "kawa":
        if "mrożon" in prod_l:
            return min(base, tsr, 50)
        if len(mt_p) > 1 and not (mt_p & {"mielona", "ziarnista", "rozpuszczalna", "palona", "bezkofeinowa"}):
            return min(base, tsr, 50)

    return base


def rank_candidates(ingredient: str, shop_products: list[dict]) -> list[tuple[float, dict]]:
    scored = [(score(ingredient, p["generic_name"]), p) for p in shop_products]
    ing_words = len(ingredient.split())
    ing_tokens = set(ingredient.lower().split())
    # Tiebreaker:
    # 1. More ingredient tokens found in product → better
    # 2. Smaller word-count difference → better
    def sort_key(x):
        s, p = x
        prod_tokens = set(p["generic_name"].lower().split())
        overlap = len(ing_tokens & prod_tokens)
        return (-s, -overlap, abs(len(p["generic_name"].split()) - ing_words))
    scored.sort(key=sort_key)
    return scored


# ── DeepSeek matching for UNCERTAIN cases ────────────────────────────────────

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
        raise RuntimeError("DEEPSEEK_API_KEY is not set")
    if OpenAI is None:
        raise RuntimeError("openai package is not installed")
    return OpenAI(api_key=key, base_url="https://api.deepseek.com")


def deepseek_match(client, batch: list[dict]) -> dict[str, list[int]]:
    """
    batch = [{"ingredient": str, "candidates": [{"idx": int, "product": str}]}]
    Returns {ingredient_name: [matching_idx, ...]}
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
                log.warning("Rate limit — waiting 10s")
                time.sleep(10)
            elif attempt < MAX_RETRIES:
                time.sleep(2)

    log.error(f"DeepSeek batch failed: {last_err}")
    return {}


# ── Building matches ──────────────────────────────────────────────────────────

def build_matches(
    unique_ingredients: list[str],
    shops: list[dict],
    lang: str,
    client,
) -> list[dict]:
    log.info(f"[{lang}] Matching {len(unique_ingredients)} ingredients against {len(shops)} products")

    # Stage 1: rapidfuzz pre-filter
    auto_matches:    dict[str, dict] = {}
    uncertain_items: list[dict]      = []
    no_match:        list[str]       = []

    for orig_ing in unique_ingredients:
        # Translate known aliases — use canonical name for matching,
        # but keep original as dict key (recipes reference original names)
        ing = _INGREDIENT_CANONICAL_PL.get(orig_ing, orig_ing) if lang == "PL" else _INGREDIENT_CANONICAL_EN.get(orig_ing, orig_ing)
        if ing.endswith(" nomatch"):
            no_match.append(orig_ing)
            continue
        ranked = rank_candidates(ing, shops)
        top_score, top_product = ranked[0] if ranked else (0, None)

        if top_score >= SCORE_AUTO:
            auto_matches[orig_ing] = (top_score, top_product)
        elif top_score >= SCORE_UNCERTAIN:
            candidates = [
                {"idx": i, "product": ranked[i][1]["generic_name"]}
                for i in range(min(MAX_CANDIDATES, len(ranked)))
                if ranked[i][0] >= SCORE_UNCERTAIN
            ]
            uncertain_items.append({"ingredient": orig_ing, "candidates": candidates, "_ranked": ranked})
        else:
            no_match.append(orig_ing)

    log.info(f"[{lang}] Auto: {len(auto_matches)}, Uncertain: {len(uncertain_items)}, No match: {len(no_match)}")

    # Stage 2: DeepSeek for UNCERTAIN
    ai_matches: dict[str, list[int]] = {}
    for i in range(0, len(uncertain_items), UNCERTAIN_BATCH):
        batch_items = uncertain_items[i:i + UNCERTAIN_BATCH]
        batch_payload = [{"ingredient": x["ingredient"], "candidates": x["candidates"]} for x in batch_items]
        result = deepseek_match(client, batch_payload)
        ai_matches.update(result)
        log.info(f"[{lang}] AI batch {i//UNCERTAIN_BATCH + 1}/{(len(uncertain_items)-1)//UNCERTAIN_BATCH + 1}: "
                 f"{len(result)} matches")
        time.sleep(0.5)

    # Stage 3: Collect results
    matches = []

    for ing, (top_score, top_product) in auto_matches.items():
        matches.append(_build_match_record(ing, top_product, "auto", top_score))

    for item in uncertain_items:
        ing     = item["ingredient"]
        ranked  = item["_ranked"]
        indices = ai_matches.get(ing, [])
        if not indices:
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

    log.info(f"[{lang}] Result: {len(matches)} matched, {len(no_match)} unmatched")
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


# ── Debug report ──────────────────────────────────────────────────────────────

def _write_debug():
    from debug_writer import write_report

    matches_en = json.loads(OUT_EN.read_text("utf-8"))
    matches_pl = json.loads(OUT_PL.read_text("utf-8"))
    unmatched_en_raw_f = UNMATCHED_EN_RAW
    unmatched_pl_raw_f = UNMATCHED_PL_RAW
    unmatched_en = json.loads(unmatched_en_raw_f.read_text("utf-8")) if unmatched_en_raw_f.exists() else []
    unmatched_pl = json.loads(unmatched_pl_raw_f.read_text("utf-8")) if unmatched_pl_raw_f.exists() else []

    total_en = len(matches_en) + len(unmatched_en)
    total_pl = len(matches_pl) + len(unmatched_pl)

    def match_row(m):
        s     = m.get("fuzzy_score", "?")
        mtype = m.get("match_type", "?")
        price = m.get("price_per_100")
        return (f"{m['ingredient_name']:<35} → {m.get('original_name', ''):<50} "
                f"| score={str(s):<5} | {mtype:<16} | {price if price is not None else '—'}")

    sections = [
        {
            "title": "Match statistics",
            "stats": {
                "Unique ingredients EN":  total_en,
                "Matched EN":             len(matches_en),
                "Unmatched EN":           len(unmatched_en),
                "Match rate EN":          f"{len(matches_en)/max(1,total_en)*100:.1f}%",
                "MATCH_AUTO EN":          sum(1 for m in matches_en if m.get("match_type") == "MATCH_AUTO"),
                "MATCH_UNCERTAIN EN":     sum(1 for m in matches_en if m.get("match_type") == "MATCH_UNCERTAIN"),
                "Unique ingredients PL":  total_pl,
                "Matched PL":             len(matches_pl),
                "Unmatched PL":           len(unmatched_pl),
                "Match rate PL":          f"{len(matches_pl)/max(1,total_pl)*100:.1f}%",
                "MATCH_AUTO PL":          sum(1 for m in matches_pl if m.get("match_type") == "MATCH_AUTO"),
                "MATCH_UNCERTAIN PL":     sum(1 for m in matches_pl if m.get("match_type") == "MATCH_UNCERTAIN"),
            },
            "rows": [],
        },
        {
            "title": "EN — matches (ingredient_name → original_name | score | type | price_per_100)",
            "rows": [match_row(m) for m in sorted(matches_en, key=lambda x: x["ingredient_name"])],
        },
        {
            "title": "EN — unmatched ingredients",
            "rows": sorted(unmatched_en),
        },
        {
            "title": "PL — matches (ingredient_name → original_name | score | type | price_per_100)",
            "rows": [match_row(m) for m in sorted(matches_pl, key=lambda x: x["ingredient_name"])],
        },
        {
            "title": "PL — unmatched ingredients",
            "rows": sorted(unmatched_pl),
        },
    ]
    write_report(3, "match_ingredients", sections)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    if OUT_EN.exists() and OUT_PL.exists():
        log.info("Output files already exist. Skipping step 3.")
        return

    recipes = json.loads(RECIPES_FILE.read_text("utf-8"))
    shops_en = json.loads(SHOPS_EN.read_text("utf-8"))
    shops_pl = json.loads(SHOPS_PL.read_text("utf-8"))

    # Collect unique ingredients from all recipes
    unique_en: set[str] = set()
    unique_pl: set[str] = set()
    for r in recipes:
        for ing in r.get("ingredients_en", []):
            if ing.get("name"):
                unique_en.add(ing["name"])
        for ing in r.get("ingredients_pl", []):
            if ing.get("name"):
                unique_pl.add(ing["name"])

    log.info(f"Unique ingredients — EN: {len(unique_en)}, PL: {len(unique_pl)}")

    client = get_client()

    # EN path
    if not OUT_EN.exists():
        matches_en, unmatched_en = build_matches(sorted(unique_en), shops_en, "EN", client)
        OUT_EN.write_text(json.dumps(matches_en, ensure_ascii=False, indent=2), "utf-8")
        UNMATCHED_EN_RAW.write_text(
            json.dumps(unmatched_en, ensure_ascii=False, indent=2), "utf-8"
        )
        log.info(f"matches_en: {len(matches_en)} → {OUT_EN}")

    # PL path
    if not OUT_PL.exists():
        matches_pl, unmatched_pl = build_matches(sorted(unique_pl), shops_pl, "PL", client)
        OUT_PL.write_text(json.dumps(matches_pl, ensure_ascii=False, indent=2), "utf-8")
        UNMATCHED_PL_RAW.write_text(
            json.dumps(unmatched_pl, ensure_ascii=False, indent=2), "utf-8"
        )
        log.info(f"matches_pl: {len(matches_pl)} → {OUT_PL}")

    _write_debug()


if __name__ == "__main__":
    main()
