#!/usr/bin/env python3
"""
Import recipes and products from the pipeline into the application database.

Usage (via Docker):
    docker exec mealprep-app-1 python /app/scraper/processing/import_to_db.py --user-id 2
    docker exec mealprep-app-1 python /app/scraper/processing/import_to_db.py --user-id 2 --lang pl
    docker exec mealprep-app-1 python /app/scraper/processing/import_to_db.py --list-users
    docker exec mealprep-app-1 python /app/scraper/processing/import_to_db.py --user-id 2 --clear
"""

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

DATA = Path(__file__).parent.parent / "data"

# Bootstrap Flask app context
sys.path.insert(0, "/app")
from app import create_app, db
from app.models.product import Product
from app.models.recipe import Recipe, RecipeIngredient
from app.models.meal_plan import MealPlan

app = create_app()


# ── Helpers ───────────────────────────────────────────────────────────────────

def load(filename: str) -> list:
    path = DATA / filename
    if not path.exists():
        print(f"File not found: {path}")
        return []
    return json.loads(path.read_text("utf-8"))


def strip_accents(s: str) -> str:
    """Remove diacritics for accent-insensitive comparison: żryżowy → ryzowy."""
    return "".join(
        c for c in unicodedata.normalize("NFKD", s)
        if not unicodedata.combining(c)
    )


def dedup_key(name: str) -> str:
    """Deduplication key: lowercase + no diacritics + collapsed whitespace."""
    return re.sub(r"\s+", " ", strip_accents(name.lower().strip()))


_EN_WORDS = re.compile(
    r"\b(easy|simple|meal prep|gluten.free|dairy.free|whole30|paleo|keto|aip|"
    r"minute rice|the |and |with |cups?|tbsp|recipe)\b", re.I
)
_PL_LETTERS = re.compile(r"[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]")


def is_english_name(name: str) -> bool:
    """Returns True if the name looks English (should not appear in the PL database)."""
    return bool(_EN_WORDS.search(name)) and not _PL_LETTERS.search(name)


# Product family collapse — many variants → one canonical name
_FAMILY_RULES: list[tuple[re.Pattern, str]] = [
    # Pasta — all variants collapse to "makaron"
    (re.compile(r"^makaron\b"),                "makaron"),
    # Rice
    (re.compile(r"^ryż\b"),                    "ryż"),
    # Oats
    (re.compile(r"^płatki owsiane|^owsian"),   "płatki owsiane"),
    # Vegetables & fruit — prefix match (no \b at end; handles Polish declensions)
    (re.compile(r"^cebula(?! dymka)"),         "cebula"),
    (re.compile(r"^czosnek"),                  "czosnek"),
    (re.compile(r"^pomidor(?! suszony)"),      "pomidor"),
    (re.compile(r"^ziemniak"),                 "ziemniaki"),
    (re.compile(r"^papryka(?! chili|ostra|cayenne|w proszku)"), "papryka"),
    (re.compile(r"^marchew|^marchewka"),       "marchew"),
    (re.compile(r"^szpinak"),                  "szpinak"),
    (re.compile(r"^ananas"),                   "ananas"),
    (re.compile(r"^awokado"),                  "awokado"),
    (re.compile(r"^banan"),                    "banan"),
    (re.compile(r"^jabłko|^jabłka"),           "jabłko"),
    (re.compile(r"^dynia(?! pestki)"),         "dynia"),
    (re.compile(r"^cukinia"),                  "cukinia"),
    (re.compile(r"^bakłażan"),                 "bakłażan"),
    (re.compile(r"^burak(?! liście)"),         "burak"),
    (re.compile(r"^gruszka|^gruszki"),         "gruszka"),
    (re.compile(r"^truskawka|^truskawki"),     "truskawki"),
    (re.compile(r"^malina|^maliny"),           "maliny"),
    (re.compile(r"^borówka|^borówki"),         "borówki"),
    (re.compile(r"^winogrona|^winogrono"),     "winogrona"),
    # Dairy — collapse to base form
    (re.compile(r"^mleko\b(?! kokosowe| migdałowe| owsiane)"), "mleko"),
    (re.compile(r"^jogurt\b(?! grecki)"),      "jogurt naturalny"),
    (re.compile(r"^ser\b(?!\s+(?:feta|parmezan|cheddar|mozzarella|twaróg|kozi|ricotta|halloumi|pleśniowy|dojrzewający|długodojrzewający|roquefort))"), "ser"),
    (re.compile(r"^śmietana\b"),               "śmietana"),
    (re.compile(r"^twaróg\b(?! kremowy)"),     "twaróg"),
    # Meat & poultry
    (re.compile(r"^kurczak\b(?! mielony)"),    "kurczak"),
    (re.compile(r"^wieprzowina\b"),            "wieprzowina"),
    (re.compile(r"^wołowina\b"),               "wołowina"),
    # Meat aliases — collapse organ/cut names to simple form
    (re.compile(r"^filet\w*\s+z\s+kurczaka"), "pierś z kurczaka"),
    (re.compile(r"^żołądk\w+"),               "żołądki z kurczaka"),
    (re.compile(r"^wątrob\w+"),               "wątroba"),
    (re.compile(r"^serce\b"),                 "serce"),
    # Vegetables — merge declined forms
    (re.compile(r"^brokuł"),                   "brokuł"),
    (re.compile(r"^ciecierzyca"),              "ciecierzyca"),
    # Legumes
    (re.compile(r"^fasola\b(?!\s+(?:czerwona|edamame))"), "fasola biała"),
    (re.compile(r"^czerwona fasola|^fasola czerwona"), "fasola czerwona"),
    (re.compile(r"^soczewica\b"),              "soczewica"),
    # Sweeteners — each one is a single canonical name
    (re.compile(r"^stewia\b|^stevia\b"),       "stewia"),
    (re.compile(r"^erytrytol\b|^erytrol\b"),   "erytrytol"),
    (re.compile(r"^ksylitol\b|^xylitol\b"),    "ksylitol"),
    # Oils — collapse to base name
    (re.compile(r"^olej z awokado"),               "olej z awokado"),
    (re.compile(r"^olej sezamowy"),                "olej sezamowy"),
    (re.compile(r"^olej kokosowy"),                "olej kokosowy"),
    (re.compile(r"^oliwa"),                        "oliwa z oliwek"),
    (re.compile(r"^olej roślinny|^olej rzepakowy|^olej słonecznikowy"), "olej roślinny"),
    # Stocks & broths
    (re.compile(r"^bulion drobiowy\b|^rosół\b(?! wołowy)"), "bulion drobiowy"),
    (re.compile(r"^bulion wołowy\b"),          "bulion wołowy"),
    (re.compile(r"^bulion warzywny\b"),        "bulion warzywny"),
    # Processed meat — all variants → simple name
    (re.compile(r"^kiełbas\w*\b|^kielbas\w*\b"), "kiełbasa"),
    (re.compile(r"^boczek\b"),                 "boczek"),
    (re.compile(r"^szynka\b"),                 "szynka"),
    (re.compile(r"^bekon\b|^boczek\s+boczek"), "bekon"),
    # Salt — all types collapse to "sól"
    (re.compile(r"^sól\b|^sol\b"),             "sól"),
    # Bread — collapse type variants to base form
    (re.compile(r"^chleb"),                    "chleb"),
    (re.compile(r"^bułka|^bułki"),             "bułka"),
    (re.compile(r"^tortilla"),                 "tortilla"),
    (re.compile(r"^wrap"),                     "wrap"),
    (re.compile(r"^krakersy"),                 "krakersy"),
    # Pastes & sauces — strip brand, keep base ingredient
    (re.compile(r"^tahini"),                   "tahini"),
    (re.compile(r"^hummus"),                   "hummus"),
    (re.compile(r"^harissa"),                  "harissa"),
    (re.compile(r"^orzeszki ziemne|^orzechy ziemne"), "orzeszki ziemne"),
    (re.compile(r"^sok z limonki|^limonka"),   "sok z limonki"),
    (re.compile(r"^sok z cytryny|^cytryna"),   "sok z cytryny"),
    # Seeds & grains — base name only
    (re.compile(r"^nasiona chia"),             "nasiona chia"),
    (re.compile(r"^siemię lniane"),            "siemię lniane"),
    (re.compile(r"^nasiona konopi"),           "nasiona konopi"),
    (re.compile(r"^pestki dyni"),              "pestki dyni"),
    (re.compile(r"^pestki słonecznika"),       "pestki słonecznika"),
    (re.compile(r"^sezam"),                    "sezam"),
    # Flakes & rice cakes
    (re.compile(r"^wafle kukurydziane"),       "wafle kukurydziane"),
    (re.compile(r"^wafle ryżowe"),             "wafle ryżowe"),
    (re.compile(r"^granola"),                  "granola"),
    # Mixed fruit
    (re.compile(r"^świeże owoce|^owoce mieszan|^mix owoc"),  "owoce mieszane"),
    # Cheeses
    (re.compile(r"^parmezan|^ser\s+parmezan|^parmigiano"),    "parmezan"),
    (re.compile(r"^mozzarella"),               "mozzarella"),
    (re.compile(r"^ser\s+feta|^feta"),         "ser feta"),
    (re.compile(r"^camembert"),                "camembert"),
    (re.compile(r"^brie"),                     "brie"),
    (re.compile(r"^ricotta"),                  "ricotta"),
    (re.compile(r"^mascarpone"),               "mascarpone"),
    # Chocolate
    (re.compile(r"^czekolada"),                "czekolada"),
    # Honey — all types (multiflower, buckwheat, etc.) collapse to "miód"
    (re.compile(r"^miód"),                     "miód"),
    # Fish — collapse to species name
    (re.compile(r"^łosoś(?! wędzony)"),        "łosoś"),
    (re.compile(r"^filet z łososia"),           "łosoś"),
    (re.compile(r"^dorsz"),                    "dorsz"),
    (re.compile(r"^tuńczyk"),                  "tuńczyk"),
    (re.compile(r"^krewetki"),                 "krewetki"),
    # Superfoods / pseudocereals
    (re.compile(r"^maca\b"),                   "maca"),
    (re.compile(r"^spirulina\b"),              "spirulina"),
    (re.compile(r"^komosa\b|^quinoa\b"),       "komosa ryżowa"),
    # Flours
    (re.compile(r"^mąka\b(?! migdałowa| kokosowa| owsiana| z ciecierzycy)"), "mąka"),
    (re.compile(r"^mąka migdałowa\b"),         "mąka migdałowa"),
    (re.compile(r"^mąka kokosowa\b"),          "mąka kokosowa"),
    # Nuts & seeds
    (re.compile(r"^orzech\w*\s+włosk\w*\b"),   "orzechy włoskie"),
    (re.compile(r"^orzech\w*\s+nerkowc\w*\b"),  "orzechy nerkowca"),
    (re.compile(r"^orzech\w*\s+laskow\w*\b"),   "orzechy laskowe"),
    (re.compile(r"^orzech\w*\s+ziemn\w*\b|^masło orzechowe\b"), "masło orzechowe"),
    (re.compile(r"^migdał\w*\b"),              "migdały"),
    # Vinegars — keep distinct because prices differ
    (re.compile(r"^ocet jabłkowy\b"),          "ocet jabłkowy"),
    (re.compile(r"^ocet balsamiczny\b"),       "ocet balsamiczny"),
    (re.compile(r"^ocet\b(?! jabłkowy| balsamiczny| winny| ryżowy)"), "ocet"),
]


def collapse_family(name: str) -> str:
    """Collapse product name variants to a single canonical family name."""
    for pattern, canonical in _FAMILY_RULES:
        if pattern.match(name):
            return canonical
    return name


def build_macro_map(macros: list, key: str) -> dict:
    """Build a name_en/name_pl → macro dict (with accent-stripped variant as fallback)."""
    result = {}
    for m in macros:
        if not m.get(key):
            continue
        val = {
            "kcal":    m.get("kcal"),
            "protein": m.get("protein_g"),
            "fat":     m.get("fat_g"),
            "carbs":   m.get("carbs_g"),
        }
        result[m[key]] = val
        result[dedup_key(m[key])] = val
    return result


# Static macros for products that have no entry in ingredients_macros.json
_STATIC_MACROS: dict[str, dict] = {
    "bułka":             {"kcal": 267, "protein": 9.0,  "fat": 3.0,  "carbs": 50.0},
    "chleb":             {"kcal": 265, "protein": 9.0,  "fat": 3.2,  "carbs": 49.0},
    "burak":             {"kcal": 43,  "protein": 1.6,  "fat": 0.2,  "carbs": 9.6},
    "kapusta fioletowa": {"kcal": 31,  "protein": 1.5,  "fat": 0.1,  "carbs": 7.4},
    "krewetki":          {"kcal": 99,  "protein": 18.0, "fat": 1.5,  "carbs": 0.9},
    "nerkowce":          {"kcal": 553, "protein": 18.2, "fat": 43.8, "carbs": 30.2},
    "nasiona konopi":    {"kcal": 553, "protein": 31.6, "fat": 48.8, "carbs": 8.7},
    "parmezan":          {"kcal": 431, "protein": 38.5, "fat": 29.0, "carbs": 3.2},
    "olej sezamowy":     {"kcal": 884, "protein": 0.0,  "fat": 100.0,"carbs": 0.0},
    "olej w sprayu":     {"kcal": 800, "protein": 0.0,  "fat": 92.0, "carbs": 0.0},
    "tortilla":          {"kcal": 312, "protein": 8.0,  "fat": 7.0,  "carbs": 52.0},
    "harissa":           {"kcal": 50,  "protein": 1.8,  "fat": 2.5,  "carbs": 5.5},
    "kapary":            {"kcal": 23,  "protein": 2.4,  "fat": 0.9,  "carbs": 4.9},
    "ziarna kakaowca":   {"kcal": 456, "protein": 14.3, "fat": 43.1, "carbs": 34.0},
    "warzywa":           {"kcal": 40,  "protein": 2.0,  "fat": 0.5,  "carbs": 7.0},
    "warzywa mieszane":  {"kcal": 40,  "protein": 2.0,  "fat": 0.5,  "carbs": 7.0},
    "gałązki ziół":      {"kcal": 40,  "protein": 3.0,  "fat": 0.5,  "carbs": 5.0},
    "ekstrakt miętowy":  {"kcal": 0,   "protein": 0.0,  "fat": 0.0,  "carbs": 0.0},
}


def fuzzy_macro(name: str, macro_map: dict) -> dict:
    """Look up macros via fuzzy match. Priority: static dict → exact → partial_ratio."""
    # 1. Static dict for known products
    static = _STATIC_MACROS.get(name.lower())
    if static:
        return static

    try:
        from rapidfuzz import process, fuzz
    except ImportError:
        return {}

    # 2. partial_ratio with false-positive guard:
    #    only accept the best result if a matched word is actually a token of the ingredient
    candidates = process.extract(
        name, macro_map.keys(),
        scorer=fuzz.partial_ratio, score_cutoff=90, limit=5
    )
    name_tokens = set(name.lower().split())
    for key, score, _ in sorted(candidates, key=lambda x: -x[1]):
        key_tokens = set(key.lower().split())
        if name_tokens & key_tokens:   # share at least one token
            return macro_map[key]

    return {}


def unit_to_app(unit: str | None) -> str:
    if unit == "pcs":
        return "szt"
    return unit or "g"


# Default weights (grams) for ingredients sold by piece (pcs/szt → g)
# Source: average weights of vegetables and fruit available in Polish shops
_PCS_WEIGHT = {
    # Vegetables
    "batat": 200,        "bataty": 200,       "słodki ziemniak": 200,
    "ziemniak": 150,     "ziemniaki": 150,
    "cebula": 100,       "cebula biała": 100, "cebula czerwona": 100,
    "cebula dymka": 15,  "szalotka": 20,
    "czosnek": 5,        # whole head ~40g, but recipes use "1 clove" = 5g
    "por": 150,
    "marchew": 80,       "marchewka": 80,
    "seler": 320,        "seler naciowy": 320, "łodyga selera": 40,  # 1 stalk ≈ 40g
    "pietruszka": 80,    "korzeń pietruszki": 80,
    "burak": 150,        "buraki": 150,
    "pomidor": 120,      "pomidory": 120,
    "papryka": 150,      "papryka czerwona": 150, "papryka zielona": 150, "papryka żółta": 150,
    "ogórek": 250,       "ogórek świeży": 250,
    "cukinia": 300,      "kabaczek": 300,
    "bakłażan": 250,
    "dynia": 1500,       # wedge of pumpkin
    "kapusta": 1000,     "kapusta głowiasta": 1000,
    "brokuł": 400,       "kalafior": 600,
    "brukselka": 20,     # 1 sprout
    "szpinak": 30,       # 1 handful of leaves ≈ 30g
    "jarmuż": 30,
    "sałata": 200,       "mix sałat": 50,     # 1 handful
    "kukurydza": 300,    # 1 cob
    "jalapeño": 15,      "jalapeno": 15,      "chili": 10,
    "awokado": 200,      "avocado": 200,
    # Fruit
    "banan": 120,
    "jabłko": 150,       "jabłka": 150,
    "gruszka": 150,
    "cytryna": 80,
    "limonka": 70,
    "pomarańcza": 150,   "mandarynka": 70,    "klementynka": 70,
    "grejpfrut": 300,
    "mango": 300,
    "ananas": 900,
    "arbuz": 4500,
    "melon": 1000,
    "kiwi": 80,
    "granat": 250,
    "figa": 50,
    "daktyl": 10,        "daktyle": 10,
    "śliwka": 40,
    "wiśnia": 8,         "czereśnia": 8,
    "morela": 40,
    "brzoskwinia": 150,
    "truskawka": 15,
    # Misc
    "jajko": 60,         "jajka": 60,         "egg": 60, "eggs": 60,
    "liść laurowy": 1,   "bay leaf": 1,
    "puszka": 400,       "can": 400,          # standard tin
    "ziarnko pieprzu": 0.05,
}


def convert_weight(amount: float | None, ing_unit: str | None,
                   prod_unit: str, ing_name: str = "") -> float | None:
    if amount is None:
        return None
    iu = (ing_unit or "g").lower()
    pu = prod_unit.lower()

    # pcs → szt (countable items): round up (0.5 egg → 1 egg)
    if iu in ("pcs", "szt") and pu == "szt":
        import math
        return math.ceil(float(amount))

    # pcs → g: use default weight when product is stored in grams
    if iu in ("pcs", "szt") and pu == "g":
        key = ing_name.lower().strip()
        default_g = _PCS_WEIGHT.get(key, 100)
        return float(amount) * default_g

    # g → szt: convert grams to pieces via default weight; round up (0.5 → 1)
    if iu in ("g", "ml") and pu == "szt":
        key = ing_name.lower().strip()
        default_g = _PCS_WEIGHT.get(key, 100)
        import math
        return math.ceil(float(amount) / default_g) if default_g else float(amount)

    # g ↔ ml: treat as 1:1 for liquids
    if {iu, pu} <= {"g", "ml"}:
        return float(amount)

    return float(amount)


# ── Product import ───────────────────────────────────────────────────────────

def import_products(user_id: int, lang: str) -> dict[str, int]:
    """Import products — 1 product per unique name (deduplicated by accent-stripped key)."""
    db_file   = "ingredient_db_en.json" if lang == "en" else "ingredient_db_pl.json"
    macro_key = "name_en"               if lang == "en" else "name_pl"

    ingredients = load(db_file)
    # Sort: products with price_per_100 first (cheapest), then those without price.
    # This ensures family collapse picks the cheapest product, not just the first one.
    ingredients.sort(key=lambda x: (
        x.get("price_per_100") is None,   # None goes last
        x.get("price_per_100") or 9999,
    ))
    macro_map   = build_macro_map(load("ingredients_macros.json"), macro_key)

    # Group by generic_name (the shop product name) — this is the authoritative key.
    # ingredient_name = specific recipe name ("makaron angel hair")
    # generic_name    = normalised shop name ("makaron")
    # We want 1 product per generic_name, but product_map must cover BOTH variants.

    seen: set[str] = set()   # dedup by generic_name key
    added = skipped_dup = skipped_en = 0
    product_map: dict[str, int] = {}

    for item in ingredients:
        ing_name     = item.get("ingredient_name", "").strip()
        generic_name = (item.get("generic_name") or ing_name).strip()

        if not ing_name:
            continue

        # Skip English names in PL import (no Polish letters + typical EN words)
        if lang == "pl" and is_english_name(ing_name) and is_english_name(generic_name):
            skipped_en += 1
            continue

        # EN: use ingredient_name (clean recipe ingredient name, e.g. "sausage")
        # PL: use generic_name (normalised shop name, e.g. "makaron") + collapse_family
        # EN generic_name comes from Aldi and is often noisy ("sausage rolls 6 pack")
        name_base = ing_name if lang == "en" else generic_name
        prod_name = collapse_family(name_base)
        prod_key  = dedup_key(prod_name)

        if prod_key in seen:
            # Product already exists — just add ingredient_name → prod_id mapping
            existing_id = product_map.get(prod_key)
            if existing_id:
                product_map[ing_name.lower()]    = existing_id
                product_map[dedup_key(ing_name)] = existing_id
            skipped_dup += 1
            continue
        seen.add(prod_key)

        price_per_100 = item.get("price_per_100")
        pkg_val       = item.get("package_size_value")
        unit          = unit_to_app(item.get("unit"))
        sold_by_wt    = bool(item.get("sold_by_weight", False))

        # Macros: look up by generic_name, ingredient_name, accent-stripped, then fuzzy
        macro = (macro_map.get(prod_name)
              or macro_map.get(dedup_key(prod_name))
              or macro_map.get(ing_name)
              or macro_map.get(dedup_key(ing_name))
              or fuzzy_macro(prod_name, macro_map)
              or {})

        prod = Product(
            user_id        = user_id,
            name           = prod_name,
            price          = round(float(price_per_100), 4) if price_per_100 else 0.0,
            package_weight = round(float(pkg_val), 1)       if pkg_val        else 100.0,
            unit           = unit,
            sold_by_weight = sold_by_wt,
            lang           = lang,
            kcal           = macro.get("kcal"),
            protein        = macro.get("protein"),
            fat            = macro.get("fat"),
            carbs          = macro.get("carbs"),
        )
        db.session.add(prod)
        db.session.flush()

        # Map BOTH name variants → the same product_id
        for k in (prod_name.lower(), prod_key, ing_name.lower(), dedup_key(ing_name)):
            product_map[k] = prod.id

        added += 1

    db.session.commit()
    print(f"  Products ({lang.upper()}): added {added}, "
          f"duplicates={skipped_dup}, skipped_english={skipped_en}")
    return product_map


# ── Recipe import ────────────────────────────────────────────────────────────

def import_recipes(user_id: int, lang: str, product_map: dict[str, int], macro_map: dict = None):
    if lang == "en":
        recipes_file = "recipes_en.json"
        name_key     = "name_en"
        ing_key      = "ingredients_en"
    else:
        recipes_file = "recipes_pl.json"
        name_key     = "name_pl"
        ing_key      = "ingredients_pl"

    recipes = load(recipes_file)
    added = skipped = placeholder_count = 0

    for r in recipes:
        name = (r.get(name_key) or "").strip()
        if not name:
            skipped += 1
            continue

        raw_cat  = r.get("category") or ""
        category = {"snacks": "snack", "desserts": "dessert"}.get(raw_cat, raw_cat) or None

        recipe = Recipe(
            user_id   = user_id,
            name      = name[:100],
            image_url = r.get("image_url"),
            source_url= r.get("url"),
            category  = category,
            lang      = lang,
        )
        db.session.add(recipe)
        db.session.flush()

        for ing in r.get(ing_key, []):
            ing_name = (ing.get("name") or "").strip().lower()
            amount   = ing.get("amount")
            unit     = ing.get("unit")

            # Look up product — exact match first, then accent-stripped fallback
            prod_id = product_map.get(ing_name) or product_map.get(dedup_key(ing_name))

            if not prod_id:
                # Create placeholder — look up macros via fuzzy match
                ph_macro = fuzzy_macro(ing_name, macro_map or {}) or {}
                placeholder = Product(
                    user_id=user_id, name=ing_name[:200],
                    price=0, package_weight=100, unit="g", sold_by_weight=False,
                    kcal    = ph_macro.get("kcal"),
                    protein = ph_macro.get("protein"),
                    fat     = ph_macro.get("fat"),
                    carbs   = ph_macro.get("carbs"),
                )
                db.session.add(placeholder)
                db.session.flush()
                product_map[ing_name] = placeholder.id
                prod_id = placeholder.id
                placeholder_count += 1

            prod_unit = db.session.get(Product, prod_id).unit or "g"
            weight    = convert_weight(amount, unit, prod_unit, ing_name)
            if weight is None or weight <= 0:
                weight = 1.0

            db.session.add(RecipeIngredient(
                recipe_id  = recipe.id,
                product_id = prod_id,
                weight     = weight,
            ))

        added += 1

    db.session.commit()
    print(f"  Recipes ({lang.upper()}): added {added}, skipped {skipped}, "
          f"placeholders {placeholder_count}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="Import pipeline → DB")
    ap.add_argument("--user-id",     type=int, default=None)
    ap.add_argument("--lang",        default="en", choices=["en", "pl"])
    ap.add_argument("--clear",       action="store_true",
                    help="Delete existing products and recipes for this user before importing")
    ap.add_argument("--list-users",  action="store_true")
    args = ap.parse_args()

    with app.app_context():
        if args.list_users:
            from app.models.user import User
            for u in User.query.all():
                prods   = Product.query.filter_by(user_id=u.id).count()
                recipes = Recipe.query.filter_by(user_id=u.id).count()
                print(f"  id={u.id}  {u.email:<35}  {prods} products, {recipes} recipes")
            return

        if not args.user_id:
            print("Provide --user-id N or --list-users")
            sys.exit(1)

        uid = args.user_id

        if args.clear:
            r_count = Recipe.query.filter_by(user_id=uid).count()
            p_count = Product.query.filter_by(user_id=uid).count()
            # Order matters due to FK constraints: meal_plans → recipe_ingredients → recipes → products
            MealPlan.query.filter_by(user_id=uid).delete()
            recipe_ids = [r.id for r in Recipe.query.filter_by(user_id=uid).all()]
            if recipe_ids:
                RecipeIngredient.query.filter(
                    RecipeIngredient.recipe_id.in_(recipe_ids)
                ).delete(synchronize_session=False)
            Recipe.query.filter_by(user_id=uid).delete()
            Product.query.filter_by(user_id=uid).delete()
            db.session.commit()
            print(f"Deleted: {r_count} recipes, {p_count} products")

        print(f"Importing for user_id={uid}, lang={args.lang}...")
        macro_key   = "name_en" if args.lang == "en" else "name_pl"
        macro_map   = build_macro_map(load("ingredients_macros.json"), macro_key)
        product_map = import_products(uid, args.lang)
        import_recipes(uid, args.lang, product_map, macro_map)
        print("Done!")


if __name__ == "__main__":
    main()
