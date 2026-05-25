#!/usr/bin/env python3
"""
Step 2: Normalizes shop products — pure Python, no AI.
- 2a. Filters ready-to-eat items (ALDI + Auchan + Biedronka)
- 2b. Extracts package size (ALDI)
- 2c. Extracts package size (Auchan / Biedronka)
- 2d. Normalizes generic_name (EN for ALDI, PL for others)
- 2e. Deduplicates (cheapest per generic_name)

Input:  data/aldi_products.json, data/auchan_products.json, data/biedronka_products.json
Output: data/aldi_normalized.json, data/auchan_normalized.json, data/biedronka_normalized.json,
        data/shops_en.json, data/shops_pl.json
"""

import re, json, sys, logging
from pathlib import Path

HERE = Path(__file__).parent
SCRAPER_ROOT = HERE.parent
sys.path.insert(0, str(SCRAPER_ROOT))
from data_paths import (  # noqa: E402
    ALI_NORMALIZED,
    ALI_PRODUCTS,
    AUCHAN_NORMALIZED,
    AUCHAN_PRODUCTS,
    BIEDRONKA_NORMALIZED,
    BIEDRONKA_PRODUCTS,
    DEFAULT_WEIGHTS,
    SHOPS_EN,
    SHOPS_PL,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger(__name__)

# ── 2a. Ready-to-eat filter (ALDI + Auchan + Biedronka) ──────────────────────

# EN keywords (ALDI)
READY_TO_EAT_EN = [
    "kabanos", "sandwich", "toastie", "soup", "goujon", "nugget", "kiev",
    "fishcake", "fish cake", "croqueta", "croquette", "koftas", "spring roll",
    "scotch egg", "munch box", "pudding", "cheesecake", "ice cream",
    "doughnut", "donut", "cupcake", "croissant", "danish", "muffin",
    "crisps", "poppadom", "poppadoms", "stackz", "wotsits", "fries pack",
    "rice pudding", "ready to eat", "ready-to-eat",
    "pasta protein pot", "meatball pasta", "lasagne", "shepherd's pie",
    "mac & cheese", "mac n cheese", "lattice", "pie for one",
    "spaghetti & meatballs",
    "wrap", "wraps",           # "bacon & cheese wraps" = prepared meal
    " pie ", " pies",          # "chicken pies" — space prefix so we don't catch "pizza"
    "custard",                 # "banana & custard yogurt" = dessert
    "cooked mussels", "cooked prawns", "cooked shrimp",
    "cooked beef", "cooked chicken", "cooked ham",  # deli meats — not raw
    "honey ham", "honey roast ham", "honey glazed", "honey cured",  # deli meats, not honey
    "fusions tuna", "fusions",  # "jalapeño fusions tuna" = flavoured tuna, not ingredient
    "vegetable burger", "veggie burger", "vegetable burgers",  # prepared burgers
    "lentil chip", "lentil bite", "kale chip", "pea chip",  # legume crisps = snack
    "pineapple & lime", "pineapple and lime",  # drink, not fruit
    "garlic bread",
    "elderflower",             # "apple & elderflower" = drink, not apple
    "butter chicken",          # Indian dish — not butter
    "mintoes", "mints pack",   # mint sweets — not butter
    "humbugs",                 # "mint humbugs" = sweets, not mint herb
    "seal bars",               # "mint seal bars" = chocolate bar
    "stir fry",                # "mushroom stir fry" = prepared dish
    "pasty", "pasties",        # "cheese & onion pasty" = prepared pastry
    "macaroni cheese",         # "pasta & sauce macaroni cheese" = prepared dish
    "mac & cheese",            # same
    "fromage frais",           # fruit yogurt product — not a single fruit
    "flavour thick",           # "apricot flavour thick yogurt" = flavoured yogurt, not fruit
    "basted",                  # "butter basted chicken" = marinated chicken, not butter
    "wheats", "wheat cereal",  # "apricot fruit wheats" = cereal, not fruit
    "fruit wheats",
    "lolly", "lollies",        # "almond mono lolly" = ice lolly
    "double strength",         # squash drinks: "double strength apple & blackcurrant squash"
    "squirty squash",          # concentrated squash drinks
    "squashies",               # drumstick squashies sweets
    "mixed fruit squash",      # = drink
    "fruit & barley",          # "fruit & barley squash" = drink
    "juice drink",             # "cranberry juice drink" = drink, not ingredient
    "yogurt granola",          # "blueberry yogurt granola" = granola, not yogurt
    "yogurt bars", "yogurt bar",  # "yogurt & strawberry bars" = bar, not yogurt
    "caramel layered yogurt", "layered yogurt",  # caramel yogurt = dessert
    "kefir yogurt",            # kefir is not plain yogurt
    "cereal hoops",            # "honey cereal hoops" = breakfast cereal, not honey
    "dauphinoise",             # "potato dauphinoise" = prepared dish, not potatoes
    "brioche swirls", "brioche roll",  # "raisin brioche swirls" = pastry, not raisins
    "sausage & mash",          # prepared dish, not sausage
    "rollitos",                # "Chorizo & Cheddar Rollitos" = snack, not chorizo
    "sourdough pizza", "wood fired pizza", "nduja",  # prepared pizza
    "chive dip", "cheese dip", "sour cream dip",  # prepared dips, not cream
    "complimints", "sugar free strawberry",  # sweets, not fruit
    "breaded prawns", "breaded prawn",       # "sriracha breaded prawns" = prepared dish
    " pizza",                                # all pizzas = prepared dish (space prefix to avoid "pizza sauce")
    "jelly beans", "jelly bean",             # sweets, not beans
    "pasta bake",                            # "tomato & pesto pasta bake" = prepared dish
    "side salad",                            # "tomato & basil side salad" = prepared salad
]

# PL keywords (Auchan / Biedronka) — complete ready-to-eat dishes
READY_TO_EAT_PL = [
    "danie ",
    "lunchbox",
    "zapiekanka",
    "pielmieni",
    "sajgonk",
    "pad thai",
    "paella",
    "bigos",
    "pierogi",
    "naleśnik",
    "kopytka",
    "gołąbki",
    "gyros",
    "sushi",
    "wrap ",
    "tortilla z",
    "pizza",
    "z kluseczkami",
    "po azjatycku",
    "słodko-kwaśny",
    "curry z",
    "ready to eat",
    "ready to cook",
    "ready-to-eat",
    "deser ",          # "deser mleczno ryżowy" etc.
    "baton ",          # energy bars
    "batonik",
    "vitanella",
    "frytki",          # prepared fries (not raw potato/sweet potato)
    "chipsy",
    "paluszki",
    "precel",
    "lody ",           # all types of ice cream
    "tortellini",
    "müllermilch",
    "zapiefix",
    "toffifee",
    "chili sin carne",
    "napój jogurtowy",
    "nesquik snack",
    "carmelove",     # Felix Carmelove — branded sweetened nuts
    "cheerios",      # Nestlé Cheerios — branded breakfast cereal
    "natural mix",   # Plony Natury mix — multi-ingredient branded product
    "actimel",       # Danone Actimel — probiotic drink
]

# Brands that only sell prepared meals (PL)
READY_BRANDS_PL = ["froста", "frosta", "proste historie", "bistro ", "family fish", "teekanne"]

WHITELIST_PATTERNS_EN = [
    r"smoked salmon",
    r"mozzarella.*slic",
    r"cheddar.*slic",
    r"pineapple.*slic",
    r"pork belly.*slic",
    r"beef\s+meatball",
    r"bacon\s*&\s*sausage",
]

# EN ingredients that are NOT prepared dishes despite suspicious keywords
WHITELIST_PATTERNS_PL = [
    r"^wątroba\b",       # wątroba = liver (ingredient)
    r"^szynka\b",        # szynka = ham (ingredient)
    r"curry\s*\d",       # "curry 50g" = spice
    r"\bproszek curry\b",
    r"\bpasta curry\b",
]


def is_whitelisted_en(name: str) -> bool:
    n = name.lower()
    return any(re.search(p, n) for p in WHITELIST_PATTERNS_EN)


def is_whitelisted_pl(name: str) -> bool:
    n = name.lower()
    return any(re.search(p, n) for p in WHITELIST_PATTERNS_PL)


def is_ready_to_eat_en(name: str, standard_category: str) -> bool:
    n = name.lower()
    if standard_category == "Przekąski i produkty gotowe":
        return True
    return any(kw in n for kw in READY_TO_EAT_EN)


def is_ready_to_eat_pl(name: str, standard_category: str) -> bool:
    n = name.lower()
    if standard_category == "Przekąski i produkty gotowe":
        return True
    if any(kw in n for kw in READY_TO_EAT_PL):
        return True
    if any(brand in n for brand in READY_BRANDS_PL):
        return True
    return False


# Backwards compat alias
def is_whitelisted(name):   return is_whitelisted_en(name)
def is_ready_to_eat(name, cat): return is_ready_to_eat_en(name, cat)


# ── Liquid detection ──────────────────────────────────────────────────────────

LIQUID_NAME_KW = {
    "milk", "oil", "juice", "sauce", "vinegar", "broth", "stock",
    "syrup", "drink", "water", "dressing", "cream", "kefir",
}
LIQUID_CAT_KW = {"drinks", "olej", "mleko", "napoj", "sok"}


def _is_liquid(name: str, category: str) -> bool:
    n = name.lower()
    c = (category or "").lower()
    return (
        any(kw in n for kw in LIQUID_NAME_KW)
        or any(kw in c for kw in LIQUID_CAT_KW)
    )


# ── Default weights for products sold by piece ───────────────────────────────

def _load_default_weights() -> dict:
    path = DEFAULT_WEIGHTS
    if path.exists():
        data = json.loads(path.read_text("utf-8"))
        return {k: v for k, v in data.items() if k != "_comment"}
    return {}

_DEFAULT_WEIGHTS = _load_default_weights()


def _default_weight_for(name: str) -> int | None:
    """Return default weight (g) for a piece-sold product, matched by keyword."""
    name_l = name.lower()
    # Try longest match first (e.g. "red grapefruit" before "grapefruit")
    best_key = None
    best_len = 0
    for key in _DEFAULT_WEIGHTS:
        if key in name_l and len(key) > best_len:
            best_key = key
            best_len = len(key)
    if best_key:
        return _DEFAULT_WEIGHTS[best_key]
    return _DEFAULT_WEIGHTS.get("default")


# ── 2b. Package size — ALDI ──────────────────────────────────────────────────

def extract_package_aldi(product: dict) -> dict:
    name        = product.get("name", "")
    price       = product.get("price")
    ppkg        = product.get("price_per_kg")
    ppl         = product.get("price_per_litre")
    pack_volume  = product.get("pack_volume")       # nowe pole ze scrapera (ml lub g)
    pack_vol_unit = product.get("pack_volume_unit") # "ml" lub "g"
    pack_size   = product.get("pack_size") or ""
    description = product.get("description", "") or ""
    category    = product.get("category", "") or ""

    pkg_val  = None
    unit     = None
    by_wt    = False
    per_100  = None
    per_unit = None

    # 1. pack_size = "4 Each" / "6 Pack"
    if pack_size and re.search(r"\b(each|pack)\b", pack_size, re.I):
        m = re.match(r"(\d+)", pack_size.strip())
        if m:
            count    = int(m.group(1))
            pkg_val  = count
            unit     = "pcs"
            per_unit = product.get("price_per_unit")
            per_100  = None

    # 2. price_per_kg exists → compute package weight
    elif ppkg and price is not None:
        if abs(price - ppkg) < 0.01:
            # Sold by weight (price == price_per_kg)
            pkg_val = 1000
            unit    = "ml" if _is_liquid(name, category) else "g"
            by_wt   = True
            per_100 = round(ppkg / 10, 4)
        else:
            grams   = round(price / ppkg * 1000, 0)
            pkg_val = grams
            unit    = "ml" if _is_liquid(name, category) else "g"
            per_100 = round(price / grams * 100, 4) if grams else None

    # 3. pack_volume from scraper (e.g. "0.5 L (£4.38/1 L)" → pack_volume=500, unit="ml")
    elif pack_volume and pack_vol_unit:
        pkg_val = pack_volume
        unit    = pack_vol_unit
        per_100 = round(price / pack_volume * 100, 4) if (price and pack_volume) else None

    # 4. price_per_litre → compute volume
    elif ppl and price is not None:
        ml = round(price / ppl * 1000, 0)
        pkg_val = ml
        unit    = "ml"
        per_100 = round(price / ml * 100, 4) if ml else None

    # 5. Weight from description or name
    else:
        for text in (description, name):
            m = re.search(r"[Ww]eight[:\s]+(\d+(?:\.\d+)?)\s*(g|kg|ml|l)\b", text)
            if not m:
                m = re.search(r"(\d+(?:\.\d+)?)\s*(g|kg|ml|l)\b", text, re.IGNORECASE)
            if m:
                val = float(m.group(1))
                u   = m.group(2).lower()
                if u == "kg": val *= 1000; u = "g"
                if u == "l":  val *= 1000; u = "ml"
                pkg_val = val
                unit    = u
                per_100 = round(price / val * 100, 4) if (price and val) else None
                break

    # 6. pcs without weight → use default_weights.json
    if unit == "pcs" and per_100 is None and price is not None:
        default_g = _default_weight_for(name)
        if default_g:
            per_100 = round(price / pkg_val / default_g * 100, 4) if pkg_val else round(price / default_g * 100, 4)

    # Sold-by-weight detection by name (fresh vegetables/fruit/fish/meat)
    _PRODUCE_EN = {
        "onion","potato","carrot","apple","banana","tomato","cucumber","pepper",
        "broccoli","cauliflower","spinach","lettuce","kale","rocket","arugula",
        "pear","plum","grapes","strawberr","raspberr","blackberr","blueberr",
        "orange","lemon","lime","avocado","mango","pineapple","peach","nectarine",
        "cabbage","leek","garlic","parsley","celery","beetroot","butternut",
        "courgette","zucchini","aubergine","eggplant","radish","asparagus",
        "mushroom","ginger","spring onion","shallot","sweet potato","turnip",
        "salad tomato","cherry tomato","vine tomato","plum tomato",
    }
    _NOT_PRODUCE_EN = {
        "sauce","vinegar","oil","juice","paste","puree","powder","extract",
        "syrup","jam","pickle","chips","crisps","soup","dip","hummus","pesto",
        "dressing","frozen","dried","tinned","canned","baked","cooked",
    }
    name_l = name.lower()
    if not by_wt and any(kw in name_l for kw in _PRODUCE_EN) and not any(kw in name_l for kw in _NOT_PRODUCE_EN):
        by_wt = True

    return {
        "package_size_value": pkg_val,
        "unit":               unit,
        "sold_by_weight":     by_wt,
        "price_per_unit":     per_unit,
        "price_per_100":      per_100,
    }


# ── 2c. Package size — Auchan / Biedronka ────────────────────────────────────

def extract_package_pl(product: dict) -> dict:
    name       = product.get("name", "")
    price      = product.get("price")
    pkg_raw    = (product.get("package_size") or "").strip()
    ppu_raw    = (product.get("price_per_unit") or "").strip()
    by_wt_orig = product.get("sold_by_weight", False)

    pkg_val  = None
    unit     = None
    by_wt    = by_wt_orig
    per_100  = None

    if pkg_raw and pkg_raw.lower() != "na wagę":
        m = re.match(
            r"(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|szt|sztuk)\b",
            pkg_raw, re.IGNORECASE
        )
        if m:
            val = float(m.group(1).replace(",", "."))
            u   = m.group(2).lower()
            if u == "kg":             val *= 1000; u = "g"
            if u == "l":              val *= 1000; u = "ml"
            if u in ("szt", "sztuk"): u = "pcs"
            pkg_val = val
            unit    = u

    if by_wt_orig and ppu_raw:
        m = re.search(r"(\d+[.,]\d+)", ppu_raw)
        if m:
            per_100 = round(float(m.group(1).replace(",", ".")) / 10, 4)
    elif unit == "pcs" and pkg_val and price:
        # Sold by piece — price_per_100 = None (no per-100g comparison)
        per_100 = None
    elif pkg_val and price and unit != "pcs":
        per_100 = round(price / pkg_val * 100, 4)

    return {
        "package_size_value": pkg_val,
        "unit":               unit,
        "sold_by_weight":     by_wt,
        "price_per_unit":     None,
        "price_per_100":      per_100,
    }


# ── 2d. Name normalization ────────────────────────────────────────────────────

# ── EN (ALDI) ─────────────────────────────────────────────────────────────────

_REMOVE_PHRASES_EN = [
    r"specially selected", r"ripe\s*&\s*ready", r"free[\s-]range",
    r"wild[\s-]caught", r"grass[\s-]fed", r"grain[\s-]fed", r"corn[\s-]fed",
    r"full[\s-]fat", r"reduced[\s-]fat", r"low[\s-]fat", r"non[\s-]fat",
    r"fat[\s-]free", r"ready[\s-]to[\s-]eat", r"pre[\s-]cooked",
    r"family\s+pack", r"twin\s+pack", r"value\s+pack",
    r"rspca\s+assured", r"red\s+tractor",
    r"aberdeen\s+angus", r"ibérico", r"iberico",
    # Apple/pear varieties — don't change the product category
    r"pink\s+lady", r"granny\s+smith", r"golden\s+delicious",
    r"braeburn", r"bramley", r"gala\b", r"fuji\b", r"jazz\b", r"cox\b",
    r"conference\b",  # Conference pear variety
]
_REMOVE_WORDS_EN = [
    r"\bxxl\b", r"\bxl\b", r"\borganic\b", r"\bbio\b",
    r"\bpremium\b", r"\bclassic\b", r"\bwonky\b", r"\bbritish\b", r"\bpolish\b",
    r"\blowfat\b", r"\blight\b", r"\bnonfat\b",
    r"\blarge\b", r"\bsmall\b", r"\bmedium\b", r"\bjumbo\b",
    r"\bbaby\b", r"\bmini\b", r"\bgiant\b",
    r"\bboneless\b", r"\bskinless\b", r"\bbone-in\b", r"\bskin-on\b",
    r"\bsliced\b", r"\bdiced\b", r"\bchopped\b", r"\bshredded\b",
    r"\bgrated\b", r"\bcooked\b", r"\bfresh\b", r"\braw\b",
    r"\bcanned\b", r"\btinned\b", r"\bjarred\b", r"\bdrained\b",
    r"\bsockeye\b", r"\bwagyu\b", r"\bhereford\b",
]

_NO_SPLIT_EN = {
    "macaroni & cheese", "mac & cheese", "fish & chips",
    "salt & vinegar", "bread & butter", "ham & cheese",
    "cookies & cream",
    "fruit & nut",          # Cadbury Fruit & Nut = bar, not "fruit" + "nut"
    "nuts & raisins",       # trail mix
    "cheese & onion",       # pasty filling — joined so "onion" doesn't become its own product
}

# When the part AFTER & is a main protein, the & is a flavor separator, not a compound
_PROTEIN_KW = re.compile(
    r"\b(loin|steak|breast|thigh|fillet|mince|ground|salmon|cod|haddock|"
    r"prawn|shrimp|lamb|chicken|beef|pork|turkey|belly|rib|wing|rasher|chop)\b"
)

_FISH_KW = re.compile(r"\b(salmon|haddock|mackerel|trout|herring|kipper|cod)\b")
_BEEF_KW = re.compile(r"\b(beef|rump|sirloin|ribeye|rib-eye)\b")


# Products that normalise incorrectly (overly aggressive brand removal or
# mince→ground leaves a single generic token causing false-positive matches). Key = lowercased original.
_NORMALIZE_OVERRIDES_EN: dict[str, str] = {
    "quorn mince": "quorn mince",
}

# Known package sizes for products Aldi does not display per-kg/per-L on the page.
# Key = generic_name after normalisation. Value = (size, unit).
_PRODUCT_SIZE_DEFAULTS_EN: dict[str, tuple[float, str]] = {
    "extra virgin olive oil": (500.0,  "ml"),
    "vegetable oil":          (1000.0, "ml"),
    "coconut water":          (1000.0, "ml"),
    "quorn mince":            (300.0,  "g"),
    "panko breadcrumbs":      (200.0,  "g"),
}


def normalize_name_en(name: str, brand: str = None) -> list[str]:
    # Direct overrides — some product names normalise too aggressively (brand removal +
    # mince→ground leave a single generic token that causes false-positive matches).
    n_key = name.lower().strip()
    if n_key in _NORMALIZE_OVERRIDES_EN:
        return [_NORMALIZE_OVERRIDES_EN[n_key]]

    n = n_key

    if brand:
        n = n.replace(brand.lower(), "")

    # Remove package size
    n = re.sub(r"\d+(?:[.,]\d+)?\s*(g|kg|ml|l|oz|lb|cl)\b", " ", n, flags=re.I)
    n = re.sub(r"\d+\s*x\s*\d+\s*(g|ml)\b", " ", n, flags=re.I)
    # Remove % fat/lean
    n = re.sub(r"\d+\s*%\s*(fat|lean|protein)?\b", " ", n, flags=re.I)
    n = re.sub(r"\b\d+/\d+\b", " ", n)  # 80/20, 93/7

    # Multi-word phrases first
    for phrase in _REMOVE_PHRASES_EN:
        n = re.sub(phrase, " ", n, flags=re.I)

    # smoked: keep for fish, remove for meat/other
    if not _FISH_KW.search(n):
        n = re.sub(r"\bsmoked\b", " ", n, flags=re.I)

    # mince/minced → ground; "X ground" → "ground X"
    n = re.sub(r"\bminced?\b", "ground", n)
    n = re.sub(r"\b(\w+)\s+ground\b", r"ground \1", n)

    # steaks: remove for fish, keep for beef
    if not _BEEF_KW.search(n):
        n = re.sub(r"\bsteaks?\b", " ", n, flags=re.I)

    # fillets, pieces, chunks, strips, joint
    n = re.sub(r"\b(fillets?|pieces|chunks|strips|joint)\b", " ", n, flags=re.I)

    # N slices
    n = re.sub(r"\d+\s*slices?\b", " ", n, flags=re.I)

    # Single words
    for word_re in _REMOVE_WORDS_EN:
        n = re.sub(word_re, " ", n, flags=re.I)

    # Split on & only when both parts are standalone same-category ingredients
    results = [n]
    if " & " in n and n.strip() not in _NO_SPLIT_EN:
        parts = [p.strip() for p in n.split(" & ")]
        if len(parts) == 2 and all(len(p.split()) >= 1 for p in parts):
            p1, p2 = parts
            # Don't split when one part is a single flavor-word and the other is multi-word product
            # e.g. "apple & berry granola" → p1="apple"(1w), p2="berry granola"(2w) → join
            # e.g. "beef & pork mince" → p1="beef"(1w), p2="pork mince"(2w) → join
            # e.g. "butter & garlic mussels" → join (avoid spurious "butter" from prepared dish)
            if len(p1.split()) == 1 and len(p2.split()) >= 2:
                results = [n.replace(" & ", " ")]  # join: "apple berry granola"
            elif len(p2.split()) == 1 and len(p1.split()) >= 2:
                results = [n.replace(" & ", " ")]  # join: "garlic butter" (rare)
            # Skip split if p2 is a protein and p1 is just a flavoring
            elif _PROTEIN_KW.search(p2) and not _PROTEIN_KW.search(p1):
                results = [n.replace(" & ", " ")]
            else:
                results = parts

    results = [re.sub(r"\s+", " ", r).strip(" -,/") for r in results]
    results = [r for r in results if len(r) > 1]
    return results


# ── PL (Auchan / Biedronka) ──────────────────────────────────────────────────

# Known brand prefixes that appear at the START of the product name — strip them.
# (sorted longest-first so "bakad'or sélection" matches before "bakad'or")
_BRAND_PREFIXES_PL = sorted([
    "bakallino",
    "bakad'or sélection",
    "bakad'or",
    "bakello",
    "marinero",
    "dawtona",
    "plony natury",
    "go vege",
    "elios",
    "kotlin",
    "kamis",
    "pano",
    "nestlé",
    "nestle",
    "felix",
    "mexicana",
    "americana",   # "Americana Tuńczyk z Warzywami" — same logic as Mexicana
    "teekanne",
    "top",
    "winiary",     # Winiary mayo/sauce/ketchup → only the product name remains
    "pewni dobrego",  # Premium Auchan brand → very expensive, not representative
], key=len, reverse=True)

# Marketing/brand words removed IN ORIGINAL CASE (before brand detection)
_MARKETING_PL_CASED = [
    r"\bBIO\b", r"\bEKO\b", r"\bBio\b", r"\bEko\b",
    r"\bPremium\b", r"\bExtra\b", r"\bSuper\b",
    r"\bKlasyczn\w*\b", r"\bNaturalny\b", r"\bNaturalna\b", r"\bNaturalne\b",
    r"\bLight\b", r"\bMAP\b",
    r"\bVital\b", r"\bFresh\b",
    r"\bXL\b", r"\bXXL\b",
    r"\bReady\b", r"\bTo\b", r"\bEat\b",  # "Ready To Eat" angielskie
]

# Substitutions and canonicalization (before normalisation, case-insensitive)
_SUBSTITUTIONS_PL = [
    (r"\bpomidork\w+\b",            "pomidor"),
    (r"\bbatatat\w*\b",             ""),
    (r"\bstevia\b",                 "stewia"),   # EN spelling → PL canonical
    (r"\berytrol\b",                "erytrytol"),
    # Yellow cheeses: order matters!
    # 1. cheddar standalone → "ser" (no preceding "ser żółty")
    (r"\bcheddar\b",               "ser"),
    # 2. remove cheese type from "ser żółty [type]" — leaves "ser żółty"
    (r"\b(?:gouda|edam(?:ski\w*)?|maasd\w*|emment\w*|tilit\w*|morbi\w*|conte\w*)\b", ""),
    # 3. "ser żółty" (after type removal) → "ser"
    (r"\bser\s+żółty\b",           "ser"),
    (r"\bxylitol\b|\bksylitol\b",   "ksylitol"),
    (r"\bquinoa\b",                 "komosa ryżowa"),
    (r"\bedamame\b",                "edamame"),
]

# Patterns that strip culinary and geographic descriptors (after lowercase)
_CULINARY_PATTERNS_PL = [
    r"\bna\s+gulasz\b",
    r"\bz\s+szynki\b",
    r"\bz\s+kością\b",
    r"\bbez\s+skóry\b",
    r"\bbez\s+kości\b",
    r"\brasy\b",
    r"\bze?\s+ściółki\b",
    r"\bze?\s+sadu\b.*",
    r"\bz\s+sadów\b.*",
    r"\bz\s+regionu\b.*",
    r"\bpicante\b",
    r"\bextra\b",
    r"\bwędzon\w*\b",
    r"\bready\s+to\b.*",            # "ready to eat/cook..."
    r"\bpochodzenia\s+\w+\b",       # "naturalnego pochodzenia" (natural origin)
    r"\bz\s+inuliną\b",             # "z inuliną" — functional additive
    r"\bsłodzik\w*\b",              # "słodzik stołowy" → removes "słodzik", leaves "erytrytol"
    r"\bstołow\w*\b",               # "stołowy" (table-top sweetener)
    r"\bkaliber\s*\d*\b",            # "kaliber 12" / "kaliber" — fruit size grade
    r"\bkwasow\w*\b.*",              # "kwasowość 5%" etc. — technical vinegar parameter
    r"\bz\s+witaminą\b.*",           # "z witaminą D tłoczony na zimno" → strip
    r"\btłoczon\w*\s+na\s+zimno\b",  # "tłoczony na zimno" — cold-press method
    r"\bśredni\b(?!\s+tłust)",      # "średni" as size, not fat content
    r"\bekstra\b",                  # "śmietana ekstra kremowa" → "śmietana kremowa"
    r"\bkremow\w*\b",               # "śmietana kremowa" → "śmietana"
    r"\błagodny\b",                 # "ketchup łagodny" → "ketchup" (mild)
    r"\bpikantny\b",                # "ketchup pikantny" → "ketchup" (spicy)
    r"\bkremsk\w*\b",               # "musztarda kremska" → "musztarda"
    r"\bfrancusk\w*\b",             # "musztarda francuska" → "musztarda"
    r"\btusz\w*\b",                 # "makrela tusza" → "makrela" (whole fish form)
    r"\bplastry\b",                 # "łosoś plastry" → "łosoś" (sliced form)
    r"\bw\s+plastrach\b",           # "ser żółty w plastrach" → "ser żółty"
    r"\btarty\b",                   # "ser żółty tarty" → "ser żółty" (grated form)
    r"\bkulka\b", r"\bkulki\b",     # "mozzarella kulka" → "mozzarella"
    r"\bnorwesk\w*\b",              # "łosoś norweski" → "łosoś" (geographic)
    r"\batlantycki\w*\b",           # "dorsz atlantycki" → "dorsz" (geographic)
    r"\bpolędwica\b",               # "dorsz polędwica" → "dorsz" (fish fillet form, not pork)
    r"\bz\s+tofu\b",                # "pesto z tofu" → "pesto"
    r"\bz\s+\w+skich\s+upraw\b.*",  # "z europejskich upraw" → strip
    # dried/cut forms intentionally kept — "jabłka suszone" ≠ "jabłka" (fresh)
    r"\bw\s+kryształkach\b",        # crystalline form
    r"\bkrystaliczn\w*\b",
    r"\bgranulat\w*\b",             # granulated form
    r"\bsypk\w*\b",                 # loose/powdered form
]

# Variety/form qualifiers for vegetables and fruit (after lowercase)
_PRODUCE_QUALIFIERS_PL = [
    r"\bmalinow\w*\b",
    r"\bcherry\b",
    r"\bdaktylowy\b",
    r"\bgałązk\w*\b",
    r"\bpęczek\b",
    r"\bsałatkow\w*\b",
    r"\bpolsk\w*\b",
    r"\bkorzeń\b", r"\bkorzeni\b",
    r"\bpiżmow\w*\b",
    r"\bpapryczkow\w*\b",
    r"\bszt\.\b",
    r"\blub\s+\w+\b",              # "lub X" (alternative)
    r"\bśredni\b",                 # fruit size
    r"\bdrobny\b", r"\bdrobne\b",
    r"\bwielk\w*\b",               # "wielkości" (size)
    r"\bróżyczki\b",               # "brokuły różyczki" → "brokuły" (florets)
    r"\bsułtański\w*\b",           # "rodzynki sułtańskie" → "rodzynki" (sultana variety)
    r"\btypu\s+islandzkiego\b",    # "skyr jogurt typu islandzkiego" → "skyr jogurt"
    r"\błuskan\w*\b",              # "migdały łuskane" → "migdały" (blanched/hulled)
    r"\bblanszow\w*\b",             # "migdały blanszowane" → "migdały"
    r"\bw\s+płatkach\b",           # "migdały w płatkach" → "migdały" (flaked)
    r"\bdługoziarnist\w*\b",       # "ryż długoziarnisty" → "ryż" (long-grain)
    r"\bkrótkoziarnist\w*\b",      # same for short-grain
]

_REMOVE_WORDS_PL = [
    r"\bbio\b", r"\beko\b", r"\bekologiczn\w*\b",
    r"\bpremium\b", r"\bklasyczn\w*\b", r"\blight\b",
    r"\bpełnotłust\w*\b", r"\bodtłuszczon\w*\b",
    r"\bchud\w*\b",
    r"\bwiejsk\w*\b",
    r"\bnaturalnie\b",
    r"\bnaturalny\b", r"\bnaturalna\b", r"\bnaturalne\b",
    r"\bśwież\w*\b",
    r"\bpasteryzowany\w*\b",
    r"\bhomogenizowany\w*\b",
    r"\bwzbogacon\w*\b",
    r"\bkonserwow\w*\b",   # konserwowy/konserwowa — packaging form
    r"\bsuperfoods?\b",     # "Superfoods" — marketing
    r"\bsmooth\b",          # "masło orzechowe smooth" → "masło orzechowe"
    r"\bcrunchy\b",         # same
    # Shop names (can appear in product names as lowercase)
    r"\bauchan\b", r"\bbiedronka\b", r"\blidl\b", r"\bnetto\b",
    # Shop category words
    r"\bowoce\b", r"\bwarzywa\b", r"\bnabiał\b", r"\bpieczywo\b",
    # Standalone units without a number (leftover after removing "1 kg" etc.)
    r"\bkg\b", r"\bszt\b", r"\bg\b", r"\bml\b",
    # "opak." leftover after package size removal
    r"\bopak\.?\b",
]

# Trailing prepositions/connectors
_TRAILING_PL = re.compile(r"\s+\b(z|ze|i|oraz|do|na|w|od|po|przy|dla|lub)\s*$", re.I)

# ── Meat canonicalization (PL) ────────────────────────────────────────────────

# Match animal → canonical Polish meat name
_ANIMAL_PL = [
    (re.compile(r"\bwoł\w+\b"),             "wołowina"),
    (re.compile(r"\bwieprzo\w+\b"),         "wieprzowina"),
    (re.compile(r"\bcielęc\w+\b"),          "cielęcina"),
    (re.compile(r"\bbarani\w+|jagnięc\w+\b"), "baranina"),
    (re.compile(r"\bindyk\w*\b"),           "indyk"),
    (re.compile(r"\bkurczak\w*|z\s+kurczaka\b"), "kurczak"),
    (re.compile(r"\bkaczk\w*|z\s+kaczki\b"),     "kaczka"),
    (re.compile(r"\bgęsi?\b"),              "gęś"),
]

_POULTRY = {"kurczak", "kaczka", "gęś", "indyk"}

# Poultry body parts — substring match (avoids \b issues with Polish characters)
# Note: "pierś" (nominative) ≠ "piersi" (genitive) — different chars ('ś' vs 'si')
_POULTRY_PARTS = [
    (re.compile(r"piersi|pierś"),   "pierś"),       # z piersi / pierś z (breast)
    (re.compile(r"\bfilet\w*\b"),   "pierś"),       # filet = breast
    (re.compile(r"szyja"),          "szyja"),       # szyja z indyka/kurczaka → szyja (nie indyk)
    (re.compile(r"udka|udziec"),    "udka"),
    (re.compile(r"skrzydełk"),      "skrzydełka"),
    (re.compile(r"nóżk"),           "nóżki"),
    (re.compile(r"polędwiczk"),     "polędwiczka"),
]

# Organ meats — NOT muscle, skip canonicalization
_ORGAN_MEATS_PL = re.compile(
    r"\b(wątrob\w+|wątróbk\w+|serc\w+|nerk\w+|flak\w*|podróbk\w+|"
    r"żołąd\w+|ozór\w*|móżdżek)\b"
)

# Indicator words confirming a meat product (not vegetable or other)
_MEAT_INDICATORS = re.compile(
    r"\b(mięso|mięs\w+|schab|żeberek|żeberka|szynka|polędwic\w+|karkówka|"
    r"boczek|łopatka|udziec|filet|pierś|udka|skrzydełka|nóżki|"
    r"wołow\w+|wieprzow\w+|cielęc\w+|barani\w+|jagnięc\w+|"
    r"kurczak\w*|kaczk\w*|gęsi?\b|indyk\w*)\b"
)


def _canonicalize_meat_pl(name: str) -> str:
    """
    If the name refers to meat, reduce to canonical form:
      - organ meats (liver, heart, kidneys): return unchanged
      - poultry: [breast/thighs/wings/feet/tenderloin] z [chicken/...]
      - other: [ground]? + [beef/pork/...]
    """
    if not _MEAT_INDICATORS.search(name):
        return name

    # Organs — return ONLY the organ name (without "z kurczaka" etc.)
    # so "żołądki z kurczaka" doesn't fuzzy-match "filet z kurczaka"
    m = _ORGAN_MEATS_PL.search(name)
    if m:
        return m.group(0)  # e.g. "żołądki", "wątroba", "serce"

    is_ground = bool(re.search(r"\bmielon\w+\b", name))

    # Detect animal
    animal = None
    for pattern, canonical in _ANIMAL_PL:
        if pattern.search(name):
            animal = canonical
            break

    if not animal:
        return name  # unrecognised — leave unchanged

    if animal in _POULTRY:
        if is_ground:
            return f"mielony {animal}"
        genitive = {"kurczak": "kurczaka", "kaczka": "kaczki",
                    "gęś": "gęsi", "indyk": "indyka"}
        gen = genitive.get(animal, animal)
        # Look for body part
        for pattern, part in _POULTRY_PARTS:
            if pattern.search(name):
                return f"{part} z {gen}"
        # No specific part — just the poultry name
        return animal
    else:
        # Beef, pork etc. — keep the specific cut if named
        if is_ground:
            return f"mielona {animal}"
        # Meat cuts — don't collapse to just the animal name
        _MEAT_CUTS = [
            (re.compile(r"\bporcja\s+rosołow\w*\b"),     "porcja rosołowa"),  # not generic meat!
            (re.compile(r"\bżeberek|żeberka\b"),         "żeberka"),
            (re.compile(r"\bschab\b"),                   "schab"),
            (re.compile(r"\bkarkówk\w*|karkow\w*"),      "karkówka"),
            (re.compile(r"\bboczek\b"),                  "boczek"),
            (re.compile(r"\budzi\w+\b"),                 "udziec"),
            (re.compile(r"\brostbef\w*|rostbeef\w*"),    "rostbef"),
            (re.compile(r"\bantryk\w+\b"),                "antrykot"),
            (re.compile(r"\bnogi\b"),                    "nogi wieprzowe"),  # not generic "wieprzowina"
            (re.compile(r"\bgolonk\w+\b"),               "golonka"),
        ]
        for pattern, cut in _MEAT_CUTS:
            if pattern.search(name):
                return cut
        return animal


def normalize_name_pl(name: str) -> str:
    """Best-effort normalisation of a Polish product name."""

    # 1. Remove "ok. N", "na wagę", package size, bare "sztuka"
    n = re.sub(r"\bok\.?\s*\d+", " ", name, flags=re.I)
    n = re.sub(r"\bna\s+wagę\b", " ", n, flags=re.I)
    n = re.sub(r"\b\d+(?:[.,]\d+)?\s*(g|kg|ml|l|szt|sztuk|cl)\b", " ", n, flags=re.I)
    n = re.sub(r"\bsztuka\b", " ", n, flags=re.I)

    # 2. Remove % patterns (brak \b po % bo % to nie word-char — "100% jabłko" → " jabłko")
    n = re.sub(r"\b\d+(?:[.,]\d+)?\s*%", " ", n)

    # 3. Substitutions (diminutives, synonyms)
    for pattern, repl in _SUBSTITUTIONS_PL:
        n = re.sub(pattern, repl, n, flags=re.I)

    # 4. Remove marketing words BEFORE brand detection (they can block lowercase detection)
    for m in _MARKETING_PL_CASED:
        n = re.sub(m, " ", n)

    n = re.sub(r"\s+", " ", n).strip()

    # 5. Brand detection
    n = re.sub(r"\s+", " ", n).strip()

    # 5a. Strip known brand prefixes from the FRONT of the name
    n_lower = n.lower()
    for brand in _BRAND_PREFIXES_PL:
        if n_lower.startswith(brand + " ") or n_lower == brand:
            n = n[len(brand):].strip(" ,.-")
            break

    # Rule A: After the FIRST lowercase word, any Title Case word = start of brand → break
    # Rule B: If NO lowercase words exist at all (e.g. "Pasztet Pewni Dobrego"),
    #         keep only the first token (rest are brand/descriptors)
    tokens = n.split()

    if not tokens:
        return ""

    has_lowercase_after_first = any(t[0].islower() for t in tokens[1:] if t)

    if not has_lowercase_after_first:
        cleaned = tokens[:1]
    else:
        cleaned = []
        seen_lower = False
        for tok in tokens:
            if not tok:
                continue
            if seen_lower and tok[0].isupper() and len(tok) >= 2:
                break
            cleaned.append(tok)
            if tok[0].islower():
                seen_lower = True

    n = " ".join(cleaned).lower()

    # 6. Meat — reduce to: [mielona] + animal (+ body part for poultry)
    n = _canonicalize_meat_pl(n)

    # 7. Remove culinary/geographic descriptions
    for pattern in _CULINARY_PATTERNS_PL:
        n = re.sub(pattern, " ", n, flags=re.I)

    # 8. Remove variety/form qualifiers (warzywa, owoce)
    for pattern in _PRODUCE_QUALIFIERS_PL:
        n = re.sub(pattern, " ", n, flags=re.I)

    # 9. Remove single marketing words
    for word_re in _REMOVE_WORDS_PL:
        n = re.sub(word_re, " ", n, flags=re.I)

    # 10. Strip trailing prepositions ("miód wielokwiatowy z" → "miód wielokwiatowy")
    n = _TRAILING_PL.sub("", n.strip())

    # 11. Final cleanup
    n = re.sub(r"\s+", " ", n).strip(" -,/.")
    return n


# ── 2e. Deduplication ────────────────────────────────────────────────────────

def deduplicate(products: list[dict]) -> list[dict]:
    """For each generic_name keep the cheapest by price_per_100 (or price_per_unit)."""
    best: dict[str, dict] = {}
    for p in products:
        key = p["generic_name"]
        if key not in best:
            best[key] = p
            continue
        existing = best[key]

        def _key(x):
            if x["price_per_100"] is not None:
                return (0, x["price_per_100"])
            if x.get("price_per_unit") is not None:
                return (1, x["price_per_unit"])
            return (2, 0)

        if _key(p) < _key(existing):
            best[key] = p
    return list(best.values())


# ── Building output records ───────────────────────────────────────────────────

def build_aldi_records(products: list[dict]) -> list[dict]:
    records = []
    filtered = 0
    for p in products:
        if is_whitelisted_en(p["name"]):
            pass  # keep
        elif is_ready_to_eat_en(p["name"], p.get("standard_category", "")):
            filtered += 1
            continue

        pkg   = extract_package_aldi(p)
        names = normalize_name_en(p.get("name", ""), p.get("brand"))

        # Fallback: for products without price_per_100, check known package sizes
        if pkg["price_per_100"] is None and p.get("price") is not None:
            for generic in names:
                size_info = _PRODUCT_SIZE_DEFAULTS_EN.get(generic)
                if size_info:
                    size_val, size_unit = size_info
                    pkg = dict(pkg)
                    pkg["package_size_value"] = size_val
                    pkg["unit"]               = size_unit
                    pkg["price_per_100"]      = round(p["price"] / size_val * 100, 4)
                    break

        for generic in names:
            if not generic:
                continue
            records.append({
                "original_name":     p["name"],
                "generic_name":      generic,
                "shop":              "aldi",
                "currency":          "GBP",
                "package_size_value": pkg["package_size_value"],
                "unit":              pkg["unit"],
                "sold_by_weight":    pkg["sold_by_weight"],
                "price_package":     p.get("price"),
                "price_per_unit":    pkg["price_per_unit"],
                "price_per_100":     pkg["price_per_100"],
                "standard_category": p.get("standard_category"),
            })
    if filtered:
        log.info(f"ALDI: filtered out {filtered} ready-to-eat items")
    return records


def build_pl_records(products: list[dict], shop: str) -> list[dict]:
    records = []
    filtered = 0
    for p in products:
        if is_whitelisted_pl(p["name"]):
            pass  # keep even if looks suspicious
        elif is_ready_to_eat_pl(p["name"], p.get("standard_category", "")):
            filtered += 1
            continue

        pkg     = extract_package_pl(p)
        generic = normalize_name_pl(p.get("name", ""))
        if not generic:
            continue
        records.append({
            "original_name":     p["name"],
            "generic_name":      generic,
            "shop":              shop,
            "currency":          "PLN",
            "package_size_value": pkg["package_size_value"],
            "unit":              pkg["unit"],
            "sold_by_weight":    pkg["sold_by_weight"],
            "price_package":     p.get("price"),
            "price_per_unit":    None,
            "price_per_100":     pkg["price_per_100"],
            "standard_category": p.get("standard_category"),
        })
    if filtered:
        log.info(f"{shop}: filtered out {filtered} ready-to-eat items")
    return records


# ── Debug report ──────────────────────────────────────────────────────────────

def _write_debug(aldi_raw, auchan_raw, biedronka_raw,
                 aldi_records, auchan_records, biedronka_records,
                 shops_en, shops_pl):
    from debug_writer import write_report

    pl_records = auchan_records + biedronka_records
    en_with = sum(1 for r in aldi_records if r.get("price_per_100") is not None)
    pl_with = sum(1 for r in pl_records if r.get("price_per_100") is not None)

    def row_en(r):
        p = r.get("price_per_100")
        return (f"{r['original_name']:<50} | {r['generic_name']:<35} "
                f"| {str(r.get('unit', '')):<6} | {p if p is not None else '—'}")

    def row_pl(r):
        p = r.get("price_per_100")
        return (f"{r.get('shop', ''):<12} | {r['original_name']:<50} "
                f"| {r['generic_name']:<35} | {str(r.get('unit', '')):<6} | {p if p is not None else '—'}")

    sections = [
        {
            "title": "Normalisation stats",
            "stats": {
                "Aldi (raw)":                 len(aldi_raw),
                "Auchan (raw)":               len(auchan_raw),
                "Biedronka (raw)":            len(biedronka_raw),
                "Aldi → records":             len(aldi_records),
                "Auchan → records":           len(auchan_records),
                "Biedronka → records":        len(biedronka_records),
                "shops_en (after dedup)":     len(shops_en),
                "shops_pl (after dedup)":     len(shops_pl),
                "EN with price (per_100)":    en_with,
                "EN without price":           len(aldi_records) - en_with,
                "PL with price (per_100)":    pl_with,
                "PL without price":           len(pl_records) - pl_with,
            },
            "rows": [],
        },
        {
            "title": "EN — Aldi products (original_name | generic_name | unit | price_per_100)",
            "rows": [row_en(r) for r in sorted(aldi_records, key=lambda x: x.get("generic_name", ""))],
            "limit": 500,
        },
        {
            "title": "PL — products (shop | original_name | generic_name | unit | price_per_100)",
            "rows": [row_pl(r) for r in sorted(pl_records, key=lambda x: x.get("generic_name", ""))],
            "limit": 500,
        },
    ]
    write_report(2, "normalize_shops", sections)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    outputs = [
        ALI_NORMALIZED,
        AUCHAN_NORMALIZED,
        BIEDRONKA_NORMALIZED,
        SHOPS_EN,
        SHOPS_PL,
    ]
    if all(f.exists() for f in outputs):
        log.info("All output files already exist. Skipping step 2.")
        return

    aldi      = json.loads(ALI_PRODUCTS.read_text("utf-8"))
    auchan    = json.loads(AUCHAN_PRODUCTS.read_text("utf-8"))
    biedronka = json.loads(BIEDRONKA_PRODUCTS.read_text("utf-8"))

    log.info(f"Aldi: {len(aldi)}, Auchan: {len(auchan)}, Biedronka: {len(biedronka)}")

    aldi_records      = build_aldi_records(aldi)
    auchan_records    = build_pl_records(auchan, "auchan")
    biedronka_records = build_pl_records(biedronka, "biedronka")

    log.info(f"After normalisation — Aldi: {len(aldi_records)}, "
             f"Auchan: {len(auchan_records)}, Biedronka: {len(biedronka_records)}")

    def save(path, data):
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), "utf-8")
        log.info(f"Saved {len(data)} → {path.name}")

    save(ALI_NORMALIZED,      aldi_records)
    save(AUCHAN_NORMALIZED,    auchan_records)
    save(BIEDRONKA_NORMALIZED, biedronka_records)

    shops_en = deduplicate(aldi_records)
    shops_pl = deduplicate(auchan_records + biedronka_records)
    save(SHOPS_EN, shops_en)
    save(SHOPS_PL, shops_pl)

    log.info(f"shops_en: {len(shops_en)} unique, shops_pl: {len(shops_pl)} unique")

    _write_debug(aldi, auchan, biedronka,
                 aldi_records, auchan_records, biedronka_records,
                 shops_en, shops_pl)


if __name__ == "__main__":
    main()
