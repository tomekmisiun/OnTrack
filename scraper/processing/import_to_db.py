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

from sqlalchemy import or_

DATA = Path(__file__).parent.parent / "data"

# Bootstrap Flask app context
sys.path.insert(0, "/app")
from app import create_app, db
from app.models.product import Product
from app.models.recipe import Recipe, RecipeIngredient
from app.models.meal_plan import MealPlan
from app.pexels import resolve_recipe_image_url

app = create_app()


def _resolve_import_image(
    recipe_name: str,
    name_en: str | None,
    source_url: str | None,
    lang: str,
) -> str | None:
    return resolve_recipe_image_url(
        recipe_name,
        name_en=name_en,
        lang=lang,
        source_url=source_url,
    )


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


_PL_TRANSLATE = str.maketrans("ąćęłńóśźż", "acelnoszz")


def dedup_key(name: str) -> str:
    """Deduplication key: lowercase + no diacritics + collapsed whitespace."""
    s = strip_accents(name.lower().strip()).translate(_PL_TRANSLATE)
    s = s.replace("-", "")
    return re.sub(r"\s+", " ", s)


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
    (re.compile(r"^brokul\w*"),                "brokuły"),
    (re.compile(r"^mieszanka coleslaw|^mieszanka do coles"), "surówka colesław"),
    (re.compile(r"^mieszanka kapusty i marchwi"), "surówka colesław"),
    (re.compile(r"^pieprz czarny|^pieprz$"),    "pieprz czarny"),
    (re.compile(r"^szpinak"),                  "szpinak"),
    (re.compile(r"^ananas"),                   "ananas"),
    (re.compile(r"^kawa$"),                   "kawa mielona"),
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
    # Salt — plain table salt only; do not merge morska/himalajska/czosnkowa
    (re.compile(r"^sól$|^sol$"),               "sól"),
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


# Prep/form suffixes that do not change the shop SKU (mielony ≈ mielona ≈ same spice jar)
_FORM_SUFFIX = re.compile(
    r"\s+(?:"
    r"mielony|mielona|mielone|"
    r"suszony|suszona|suszone|"
    r"świeży|świeża|świeże|"
    r"starty|starta|starte|"
    r"tarty|tarta|tarte|"
    r"krojony|krojona|krojone|"
    r"granulowany|granulowana|granulowane|"
    r"w proszku|"
    r"cały|cała|całe|"
    r"ziarnisty|ziarnista|"
    r")$",
    re.I,
)


# Pipeline typos / spelling variants → canonical Polish name
_TYPO_FIXES = [
    (re.compile(r"\bwoowina\b", re.I), "wołowina"),
    (re.compile(r"\bbrokuly\b", re.I), "brokuły"),
    (re.compile(r"\bsmietana\b", re.I), "śmietana"),
    (re.compile(r"\bbrokul\b", re.I), "brokuł"),
]


def fix_pl_typos(name: str) -> str:
    s = _MACRO_TYPOS.get(name.lower(), name)
    for pattern, replacement in _TYPO_FIXES:
        s = pattern.sub(replacement, s)
    return s


def canonical_ingredient_name(name: str) -> str:
    """Merge ingredient variants that map to the same shop product."""
    base = collapse_family(name.strip())
    base = fix_pl_typos(base)
    base = base.replace("-", "").strip()
    while True:
        stripped = _FORM_SUFFIX.sub("", base).strip()
        if stripped == base:
            break
        base = stripped
    return base


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
    "mielona woowina":   {"kcal": 215, "protein": 19.0, "fat": 14.0, "carbs": 0.0},
    "brukselka":         {"kcal": 41,  "protein": 3.4,  "fat": 0.3,  "carbs": 7.0},
    "brązowy ryż":       {"kcal": 111, "protein": 2.6,  "fat": 0.9,  "carbs": 23.0},
    "brązowy cukier":    {"kcal": 380, "protein": 0.1,  "fat": 0.0,  "carbs": 98.0},
    "mleko migdałowe":   {"kcal": 17,  "protein": 0.6,  "fat": 1.5,  "carbs": 0.6},
    "mleko owsiane":     {"kcal": 47,  "protein": 1.0,  "fat": 1.5,  "carbs": 7.0},
    "czerwona cebula":   {"kcal": 40,  "protein": 1.1,  "fat": 0.1,  "carbs": 9.3},
    "twaróg kremowy":    {"kcal": 342, "protein": 6.2,  "fat": 34.0, "carbs": 4.1},
    "ogórek kiszony":    {"kcal": 11,  "protein": 0.5,  "fat": 0.1,  "carbs": 2.0},
    "mielony indyk":     {"kcal": 135, "protein": 21.0, "fat": 5.0,  "carbs": 0.0},
}


_MACRO_TYPOS: dict[str, str] = {
    "brokuly": "brokuły",
    "brokul": "brokuł",
    "mielona woowina": "mielona wołowina",
    "kur-kuma": "kurkuma",
    "smietana": "śmietana",
    "komosa ryzowa": "komosa ryżowa",
    "ocet ryzowy": "ocet ryżowy",
}


def resolve_unit_price(item: dict) -> tuple[float, str, float, bool]:
    """Derive stored unit price, unit, package size, sold_by_weight from a shop match."""
    unit = unit_to_app(item.get("unit"))
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


_GENERIC_STANDALONE = {"mieszanka", "przyprawa", "sos", "dodatki", "mix"}
_MATCH_SKIP = {"do", "na", "z", "i", "w", "o", "ze", "od", "po"}
_SCORE_AUTO = 85


def _macro_candidates(*names: str) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for raw in names:
        if not raw:
            continue
        for candidate in (raw, _MACRO_TYPOS.get(raw), _MACRO_TYPOS.get(dedup_key(raw))):
            if not candidate:
                continue
            for key in (candidate, dedup_key(candidate)):
                if key and key not in seen:
                    seen.add(key)
                    out.append(key)
    return out


def token_macro(name: str, macro_map: dict) -> dict:
    """Match macros by substring / shared tokens when exact lookup fails."""
    name_key = dedup_key(name)
    if not name_key:
        return {}

    best: dict = {}
    best_len = 0
    name_tokens = set(name_key.split())

    for key, val in macro_map.items():
        if not val.get("kcal"):
            continue
        key_norm = dedup_key(key)
        if not key_norm or len(key_norm) < 3:
            continue
        if key_norm in name_key or name_key in key_norm:
            if len(key_norm) > best_len:
                best_len = len(key_norm)
                best = val
            continue
        key_tokens = set(key_norm.split())
        if name_tokens & key_tokens and len(key_norm) > best_len:
            best_len = len(key_norm)
            best = val

    return best


def lookup_macro(*names: str, macro_map: dict) -> dict:
    """Resolve macros from ingredient / generic / canonical product names."""
    for candidate in _macro_candidates(*names):
        static = _STATIC_MACROS.get(candidate)
        if static:
            return static
        hit = macro_map.get(candidate)
        if hit and (hit.get("kcal") or 0) > 0:
            return hit

    for name in names:
        if not name:
            continue
        fuzzy = fuzzy_macro(name, macro_map)
        if fuzzy:
            return fuzzy
        token = token_macro(name, macro_map)
        if token:
            return token

    return {}


def fuzzy_macro(name: str, macro_map: dict) -> dict:
    """Look up macros via fuzzy match. Priority: static dict → partial_ratio."""
    static = _STATIC_MACROS.get(name.lower()) or _STATIC_MACROS.get(dedup_key(name))
    if static:
        return static

    try:
        from rapidfuzz import process, fuzz
    except ImportError:
        return {}

    candidates = process.extract(
        name, macro_map.keys(),
        scorer=fuzz.partial_ratio, score_cutoff=85, limit=8
    )
    name_tokens = set(dedup_key(name).split())
    for key, score, _ in sorted(candidates, key=lambda x: -x[1]):
        key_tokens = set(dedup_key(key).split())
        if len(key_tokens) == 1 and key_tokens <= _GENERIC_STANDALONE and name_tokens - key_tokens:
            continue
        if name_tokens & key_tokens:
            hit = macro_map[key]
            if (hit.get("kcal") or 0) > 0:
                return hit

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
    "kiełbasa": 50,      "kielbasa": 50,      "sausage": 50, "sausages": 50,
    "bekon": 15,         "bacon": 15,
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
        # brewed coffee in ml → ground coffee in g (~5 ml liquid ≈ 1 g grounds)
        if ing_name.lower() == "kawa" and iu == "ml" and pu == "g":
            return max(float(amount) / 5.0, 0.5)
        return float(amount)

    return float(amount)


# ── Match repair (re-score bad pipeline matches against shop catalog) ────────


def _load_ingredient_aliases(lang: str) -> dict[str, str]:
    path = DATA / "ingredient_aliases.json"
    if not path.exists():
        return {}
    data = json.loads(path.read_text("utf-8"))
    return data.get(lang, {})


def _unavailable_ingredients(lang: str) -> set[str]:
    """Ingredient names marked as not buyable in PL/EN shop data."""
    unavailable: set[str] = set()
    for name, alias in _load_ingredient_aliases(lang).items():
        if alias.endswith(" nomatch"):
            unavailable.add(name.lower())
            unavailable.add(dedup_key(name))
    return unavailable


def _match_tokens(text: str) -> set[str]:
    return {t for t in text.lower().split() if len(t) > 1 and t not in _MATCH_SKIP}


def is_bad_match(item: dict) -> bool:
    """Detect pipeline matches where generic_name is too vague or wrong category."""
    ing = (item.get("ingredient_name") or "").strip().lower()
    gen = (item.get("generic_name") or "").strip().lower()
    orig = (item.get("original_name") or "").strip().lower()
    if not ing or not gen:
        return True

    if gen in _GENERIC_STANDALONE and ing != gen:
        return True

    mt_i, mt_p = _match_tokens(ing), _match_tokens(gen)
    if len(mt_p) == 1:
        token = next(iter(mt_p))
        if token in _GENERIC_STANDALONE and mt_i - {token}:
            return True

    if ing in {"pieprz", "sól", "sol"} and len(mt_p) > len(mt_i):
        return True

    if ing in {"sól", "sol"}:
        if any(x in gen for x in ("czosnkowa", "morska", "himalajska", "gruboziarnista", "różowa")):
            return True

    if ing == "pieprz":
        extra = mt_p - {"pieprz", "czarny", "mielony", "ziarnisty"}
        if extra & {"czosnkowy", "cytrynowy", "cayenne", "kolorowy", "ziołowy"}:
            return True

    if "coleslaw" in ing or "colesław" in ing or "coleslawa" in ing:
        if "coleslaw" not in gen and "colesław" not in gen:
            return True

    if ing == "dodatki" and "herbat" in orig:
        return True

    if ing == "kawa" and ("mrożona" in gen or "mrożona" in orig):
        return True

    return False


def _shop_product_to_match(ingredient: str, product: dict, score_val: float) -> dict:
    return {
        "ingredient_name":    ingredient,
        "match_type":         "repair",
        "fuzzy_score":        round(float(score_val), 1),
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


def _is_spice_like(name: str) -> bool:
    n = name.lower()
    return any(k in n for k in ("pieprz", "przyprawa", "papryka", "sól", "sol", "chili", "kurkuma"))


def _shop_product_key(item: dict) -> str:
    shop = (item.get("shop") or "").strip().lower()
    orig = (item.get("original_name") or "").strip().lower()
    if shop and orig:
        return f"{shop}|{orig}"
    return ""


def _pick_shop_product(
    ing_name: str,
    ranked: list[tuple[float, dict]],
    query: str | None = None,
) -> dict | None:
    good = [(s, p) for s, p in ranked if s >= _SCORE_AUTO]
    if not good:
        return None

    if query:
        q = query.strip().lower()
        exact = [(s, p) for s, p in good if (p.get("generic_name") or "").strip().lower() == q]
        if exact:
            good = exact

    max_score = max(s for s, _ in good)
    top = [(s, p) for s, p in good if s >= max_score - 0.5]

    if _is_spice_like(ing_name):
        small = [(s, p) for s, p in top if (p.get("package_size_value") or 999) <= 50]
        if small:
            top = small

    return min(top, key=lambda x: resolve_unit_price(x[1])[0] or 9999)[1]


def product_display_name(ing_name: str, generic_name: str, canonical: str) -> str:
    """Use a specific shop/generic name when the ingredient label is too vague."""
    vague = _GENERIC_STANDALONE | {"sos", "przyprawa", "pieprz"}
    if canonical.lower() in vague and generic_name:
        return collapse_family(generic_name.strip())[:200]
    return canonical


def repair_ingredient_matches(ingredients: list[dict], lang: str) -> list[dict]:
    """Re-match ingredients with obviously wrong shop products."""
    shops_file = DATA / f"shops_{lang}.json"
    if not shops_file.exists():
        return ingredients

    sys.path.insert(0, str(Path(__file__).parent.parent))
    from processing.match_ingredients import rank_candidates

    shops = json.loads(shops_file.read_text("utf-8"))
    aliases = _load_ingredient_aliases(lang)
    repaired: list[dict] = []
    fixed = skipped = 0

    for item in ingredients:
        ing = (item.get("ingredient_name") or "").strip()
        if not ing:
            continue

        alias = aliases.get(ing) or aliases.get(ing.lower())
        if alias and alias.endswith(" nomatch"):
            skipped += 1
            continue

        needs_rematch = is_bad_match(item)
        if alias and alias.lower() != (item.get("generic_name") or "").lower():
            needs_rematch = True
        if ing.lower() in _GENERIC_STANDALONE | {"sos", "przyprawa", "pieprz"} and alias:
            needs_rematch = True

        if not needs_rematch:
            repaired.append(item)
            continue

        query = alias or ing
        ranked = rank_candidates(query, shops)
        product = _pick_shop_product(ing, ranked, query=query if alias else None)
        if product:
            score_val = next((s for s, p in ranked if p is product), ranked[0][0] if ranked else 0)
            repaired.append(_shop_product_to_match(ing, product, score_val))
            fixed += 1
        elif needs_rematch:
            skipped += 1
        else:
            repaired.append(item)

    if fixed or skipped:
        print(f"  Match repair ({lang.upper()}): fixed {fixed}, skipped {skipped}")
    return repaired


# ── Import debug report (UI product name → shop match) ───────────────────────

def _alias_for(ing: str, aliases: dict[str, str]) -> str:
    return aliases.get(ing) or aliases.get(ing.lower()) or ""


def _product_map_entry(
    *,
    ui_name: str,
    ingredient: str,
    item: dict,
    alias: str,
    unit_price: float,
    unit: str,
    pkg_val: float,
    kcal,
    dedup: str = "",
) -> dict:
    return {
        "ui_name":        ui_name,
        "ingredient":     ingredient,
        "alias":          alias,
        "shop":           item.get("shop") or "",
        "generic_name":   item.get("generic_name") or "",
        "original_name":  item.get("original_name") or "",
        "package_weight": pkg_val,
        "unit":           unit,
        "price":          unit_price,
        "price_package":  item.get("price_package"),
        "match_type":     item.get("match_type") or "",
        "fuzzy_score":    item.get("fuzzy_score"),
        "dedup":          dedup,
        "kcal":           kcal,
    }


def _format_map_row(entry: dict) -> str:
    dedup = f" | dedup={entry['dedup']}" if entry.get("dedup") else ""
    alias = entry.get("alias") or "—"
    score = entry.get("fuzzy_score")
    score_s = f"{score}" if score is not None else "—"
    orig = (entry.get("original_name") or "—")[:55]
    return (
        f"{entry['ui_name']:<35} | ing={entry['ingredient']:<28} | "
        f"alias={alias:<28} | {entry.get('shop') or '—':<10} | "
        f"{orig:<55} | {entry['price']:.4f}/{entry['unit']} "
        f"pkg={entry['package_weight']}{entry['unit'][:1]} | score={score_s}{dedup}"
    )


def write_import_product_map(
    lang: str,
    entries: list[dict],
    skipped: list[str],
    stats: dict,
) -> None:
    """Write UI→shop mapping after import_to_db repair + dedup."""
    from debug_writer import write_report, DEBUG_DIR

    rows = [_format_map_row(e) for e in sorted(entries, key=lambda x: x["ui_name"].lower())]
    sections = [
        {
            "title": f"Import product map ({lang.upper()}) — stats",
            "stats": stats,
            "rows": [],
        },
        {
            "title": (
                "Nazwa w liście produktów | składnik | alias | sklep | "
                "original_name | cena | dedup"
            ),
            "rows": rows,
        },
    ]
    if skipped:
        sections.append({
            "title": f"Pominięte składniki (nomatch / brak dopasowania) — {len(skipped)}",
            "rows": skipped,
        })

    write_report(7, f"import_product_map_{lang}", sections)

    csv_path = DEBUG_DIR / f"import_product_map_{lang}.csv"
    DEBUG_DIR.mkdir(parents=True, exist_ok=True)
    header = (
        "ui_name;ingredient;alias;shop;generic_name;original_name;"
        "package_weight;unit;price_per_100;price_package;match_type;fuzzy_score;dedup;kcal"
    )
    csv_lines = [header]
    for e in sorted(entries, key=lambda x: x["ui_name"].lower()):
        csv_lines.append(";".join([
            e["ui_name"],
            e["ingredient"],
            e.get("alias") or "",
            e.get("shop") or "",
            e.get("generic_name") or "",
            e.get("original_name") or "",
            str(e.get("package_weight") or ""),
            e.get("unit") or "",
            str(e.get("price") or ""),
            str(e.get("price_package") if e.get("price_package") is not None else ""),
            e.get("match_type") or "",
            str(e.get("fuzzy_score") if e.get("fuzzy_score") is not None else ""),
            e.get("dedup") or "",
            str(e.get("kcal") if e.get("kcal") is not None else ""),
        ]))
    csv_path.write_text("\n".join(csv_lines), encoding="utf-8")
    print(f"[debug] → {csv_path.name}  ({len(entries)} wierszy)")


def compute_product_map_plan(lang: str) -> tuple[list[dict], list[str], dict]:
    """
    Simulate import_to_db product mapping (repair + dedup) without touching the DB.
    Used for step-7 debug reports for both EN and PL catalogs.
    """
    db_file = "ingredient_db_en.json" if lang == "en" else "ingredient_db_pl.json"
    macro_key = "name_en" if lang == "en" else "name_pl"

    ingredients = load(db_file)
    raw_ingredients = list(ingredients)
    aliases = _load_ingredient_aliases(lang)
    ingredients = repair_ingredient_matches(ingredients, lang)
    skipped_ings = sorted({
        i.get("ingredient_name", "").strip()
        for i in raw_ingredients
        if i.get("ingredient_name", "").strip()
    } - {
        i.get("ingredient_name", "").strip()
        for i in ingredients
        if i.get("ingredient_name", "").strip()
    })
    ingredients.sort(key=lambda x: resolve_unit_price(x)[0] or 9999)
    macro_map = build_macro_map(load("ingredients_macros.json"), macro_key)

    seen: set[str] = set()
    shop_product_ids: dict[str, int] = {}
    display_by_prod_key: dict[str, str] = {}
    display_by_sp_key: dict[str, str] = {}
    map_entries: list[dict] = []
    added = skipped_dup = skipped_en = 0
    next_id = 1

    for item in ingredients:
        ing_name = item.get("ingredient_name", "").strip()
        generic_name = (item.get("generic_name") or ing_name).strip()
        if not ing_name:
            continue

        if lang == "pl" and is_english_name(ing_name) and is_english_name(generic_name):
            skipped_en += 1
            continue

        prod_name = canonical_ingredient_name(ing_name)
        prod_key = dedup_key(prod_name)
        display_name = product_display_name(ing_name, generic_name, prod_name)
        unit_price, unit, pkg_val, _sold_by_wt = resolve_unit_price(item)
        macro = lookup_macro(generic_name, prod_name, ing_name, macro_map=macro_map)

        entry = _product_map_entry(
            ui_name=display_name,
            ingredient=ing_name,
            item=item,
            alias=_alias_for(ing_name, aliases),
            unit_price=unit_price,
            unit=unit,
            pkg_val=pkg_val,
            kcal=macro.get("kcal"),
        )

        sp_key = _shop_product_key(item)
        if sp_key and sp_key in shop_product_ids:
            entry["ui_name"] = display_by_sp_key.get(sp_key, display_name)
            entry["dedup"] = "shop_sku"
            map_entries.append(entry)
            skipped_dup += 1
            continue

        if prod_key in seen:
            entry["ui_name"] = display_by_prod_key.get(prod_key, display_name)
            entry["dedup"] = "canonical_name"
            map_entries.append(entry)
            skipped_dup += 1
            continue

        seen.add(prod_key)
        if sp_key:
            shop_product_ids[sp_key] = next_id
            display_by_sp_key[sp_key] = display_name
            next_id += 1
        display_by_prod_key[prod_key] = display_name
        map_entries.append(entry)
        added += 1

    stats = {
        "Wiersze mapowania (składnik → sklep)": len(map_entries),
        "Unikalne nazwy w UI (products.name)": len({e["ui_name"] for e in map_entries}),
        "Nowe produkty w katalogu": added,
        "Scalone duplikaty": skipped_dup,
        "Pominięte EN w PL": skipped_en if lang == "pl" else 0,
        "Pominięte nomatch/repair": len(skipped_ings),
    }
    return map_entries, skipped_ings, stats


def write_import_product_maps(langs: tuple[str, ...] = ("en", "pl")) -> None:
    """Write step-7 debug map files for each language catalog."""
    for lang in langs:
        entries, skipped, stats = compute_product_map_plan(lang)
        write_import_product_map(lang, entries, skipped, stats)


# ── Product import ───────────────────────────────────────────────────────────

def import_products(user_id: int, lang: str) -> dict[str, int]:
    """Import products — 1 product per unique name (deduplicated by accent-stripped key)."""
    db_file   = "ingredient_db_en.json" if lang == "en" else "ingredient_db_pl.json"
    macro_key = "name_en"               if lang == "en" else "name_pl"

    ingredients = load(db_file)
    raw_ingredients = list(ingredients)
    aliases = _load_ingredient_aliases(lang)
    ingredients = repair_ingredient_matches(ingredients, lang)
    skipped_ings = sorted({
        i.get("ingredient_name", "").strip()
        for i in raw_ingredients
        if i.get("ingredient_name", "").strip()
    } - {
        i.get("ingredient_name", "").strip()
        for i in ingredients
        if i.get("ingredient_name", "").strip()
    })
    # Prefer matches with a usable price (per 100g/ml or per szt from package price).
    ingredients.sort(key=lambda x: resolve_unit_price(x)[0] or 9999)
    macro_map   = build_macro_map(load("ingredients_macros.json"), macro_key)

    # Group by canonical ingredient name; product_map covers name variants for matching.
    seen: set[str] = set()
    shop_product_ids: dict[str, int] = {}
    display_by_prod_key: dict[str, str] = {}
    display_by_sp_key: dict[str, str] = {}
    map_entries: list[dict] = []
    added = skipped_dup = skipped_en = 0
    product_map: dict[str, int] = {}

    def _record_map(
        item: dict,
        ing_name: str,
        display_name: str,
        unit_price: float,
        unit: str,
        pkg_val: float,
        kcal,
        dedup: str = "",
    ) -> None:
        map_entries.append(_product_map_entry(
            ui_name=display_name,
            ingredient=ing_name,
            item=item,
            alias=_alias_for(ing_name, aliases),
            unit_price=unit_price,
            unit=unit,
            pkg_val=pkg_val,
            kcal=kcal,
            dedup=dedup,
        ))

    for item in ingredients:
        ing_name     = item.get("ingredient_name", "").strip()
        generic_name = (item.get("generic_name") or ing_name).strip()

        if not ing_name:
            continue

        # Skip English names in PL import (no Polish letters + typical EN words)
        if lang == "pl" and is_english_name(ing_name) and is_english_name(generic_name):
            skipped_en += 1
            continue

        # Use canonical ingredient name for both languages (e.g. "jajka", "sausage").
        # generic_name is the matched shop label and is often long/noisy.
        prod_name = canonical_ingredient_name(ing_name)
        prod_key  = dedup_key(prod_name)
        display_name = product_display_name(ing_name, generic_name, prod_name)
        unit_price, unit, pkg_val, sold_by_wt = resolve_unit_price(item)
        macro = lookup_macro(
            generic_name, prod_name, ing_name,
            macro_map=macro_map,
        )

        sp_key = _shop_product_key(item)
        if sp_key and sp_key in shop_product_ids:
            existing_id = shop_product_ids[sp_key]
            ui_name = display_by_sp_key.get(sp_key, display_name)
            for k in (prod_name.lower(), prod_key, ing_name.lower(), dedup_key(ing_name)):
                product_map[k] = existing_id
            _record_map(item, ing_name, ui_name, unit_price, unit, pkg_val,
                        macro.get("kcal"), dedup="shop_sku")
            skipped_dup += 1
            continue

        if prod_key in seen:
            # Product already exists — just add ingredient_name → prod_id mapping
            existing_id = product_map.get(prod_key)
            ui_name = display_by_prod_key.get(prod_key, display_name)
            if existing_id:
                product_map[ing_name.lower()]    = existing_id
                product_map[dedup_key(ing_name)] = existing_id
            _record_map(item, ing_name, ui_name, unit_price, unit, pkg_val,
                        macro.get("kcal"), dedup="canonical_name")
            skipped_dup += 1
            continue
        seen.add(prod_key)

        prod = Product(
            user_id        = user_id,
            name           = display_name,
            price          = unit_price,
            package_weight = pkg_val,
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
        if sp_key:
            shop_product_ids[sp_key] = prod.id
            display_by_sp_key[sp_key] = display_name
        display_by_prod_key[prod_key] = display_name
        _record_map(item, ing_name, display_name, unit_price, unit, pkg_val,
                     macro.get("kcal"))

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
    unavailable = _unavailable_ingredients(lang)

    for r in recipes:
        name = (r.get(name_key) or "").strip()
        if not name:
            skipped += 1
            continue

        recipe_ings = r.get(ing_key, [])
        if unavailable and any(
            (ing.get("name") or "").strip().lower() in unavailable
            or dedup_key((ing.get("name") or "").strip()) in unavailable
            for ing in recipe_ings
        ):
            skipped += 1
            continue

        raw_cat  = r.get("category") or ""
        category = {"snacks": "snack", "desserts": "dessert"}.get(raw_cat, raw_cat) or None

        recipe = Recipe(
            user_id   = user_id,
            name      = name[:100],
            image_url = _resolve_import_image(
                name, r.get("name_en"), r.get("url"), lang,
            ),
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
                    lang=lang,
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


def clear_lang_data(user_id: int, lang: str):
    """Remove all products and recipes for one language version."""
    recipe_ids = [r.id for r in Recipe.query.filter_by(user_id=user_id, lang=lang).all()]
    product_ids = [p.id for p in Product.query.filter_by(user_id=user_id, lang=lang).all()]

    if recipe_ids:
        MealPlan.query.filter(MealPlan.recipe_id.in_(recipe_ids)).delete(synchronize_session=False)

    # Drop ingredients for this lang's recipes and any cross-lang refs to its products.
    ing_filters = []
    if recipe_ids:
        ing_filters.append(RecipeIngredient.recipe_id.in_(recipe_ids))
    if product_ids:
        ing_filters.append(RecipeIngredient.product_id.in_(product_ids))
    if ing_filters:
        db.session.query(RecipeIngredient).filter(or_(*ing_filters)).delete(
            synchronize_session=False
        )

    Recipe.query.filter_by(user_id=user_id, lang=lang).delete()
    if product_ids:
        Product.query.filter(Product.id.in_(product_ids)).delete(synchronize_session=False)
    db.session.commit()


def import_lang_catalog(user_id: int, lang: str):
    """Import products + recipes from pipeline JSON for one language."""
    macro_key = "name_en" if lang == "en" else "name_pl"
    macro_map = build_macro_map(load("ingredients_macros.json"), macro_key)
    product_map = import_products(user_id, lang)
    import_recipes(user_id, lang, product_map, macro_map)
    write_import_product_maps()


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="Import pipeline → DB")
    ap.add_argument("--user-id",     type=int, default=None)
    ap.add_argument("--lang",        default="en", choices=["en", "pl"])
    ap.add_argument("--clear",       action="store_true",
                    help="Delete existing products and recipes for this user before importing")
    ap.add_argument("--clear-lang",  default=None, choices=["en", "pl"],
                    help="Delete only products/recipes for this language, then import")
    ap.add_argument("--product-maps-only", action="store_true",
                    help="Only write step-7 import_product_map_{en,pl} debug files (no DB import)")
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

        if not args.user_id and not args.product_maps_only:
            print("Provide --user-id N or --list-users")
            sys.exit(1)

        if args.product_maps_only:
            print("Generating import product maps (EN + PL)...")
            write_import_product_maps()
            print("Done!")
            return

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
        elif getattr(args, "clear_lang", None):
            clear_lang_data(uid, args.clear_lang)
            print(f"Cleared lang={args.clear_lang} catalog for user {uid}")

        print(f"Importing for user_id={uid}, lang={args.lang}...")
        import_lang_catalog(uid, args.lang)
        print("Done!")


if __name__ == "__main__":
    main()
