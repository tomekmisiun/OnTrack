#!/usr/bin/env python3
"""
Krok 2: Normalizuje produkty sklepowe — czysty Python, bez AI.
- 2a. Filtruje gotowe dania (tylko ALDI)
- 2b. Wyciąga gramaturę (ALDI)
- 2c. Wyciąga gramaturę (Auchan / Biedronka)
- 2d. Normalizuje generic_name (EN dla ALDI, PL dla pozostałych)
- 2e. Deduplikuje (najtańszy per generic_name)

Wejście:  data/aldi_products.json, data/auchan_products.json, data/biedronka_products.json
Wyjście:  data/aldi_normalized.json, data/auchan_normalized.json, data/biedronka_normalized.json,
          data/shops_en.json, data/shops_pl.json
"""

import re, json, sys, logging
from pathlib import Path

HERE = Path(__file__).parent
DATA = HERE.parent / "data"

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger(__name__)

# ── 2a. Filtr gotowych dań (ALDI + Auchan + Biedronka) ───────────────────────

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
    "wrap", "wraps",           # "bacon & cheese wraps" = gotowy posiłek
    " pie ", " pies",          # "chicken pies" — "pies" bez trailing space żeby łapać końcówki
    "custard",                 # "banana & custard yogurt" = deser
    "cooked mussels", "cooked prawns", "cooked shrimp",
    "cooked beef", "cooked chicken", "cooked ham",  # deli meats — nie surowe
    "honey ham", "honey roast ham", "honey glazed", "honey cured",  # deli meats, nie miód
    "fusions tuna", "fusions",  # "jalapeño fusions tuna" = tuńczyk w smaku jalapeño
    "vegetable burger", "veggie burger", "vegetable burgers",  # gotowe burgery
    "lentil chip", "lentil bite", "kale chip", "pea chip",  # chipsy ze strączkowych = przekąska
    "pineapple & lime", "pineapple and lime",  # napój, nie owoc
    "garlic bread",
    "elderflower",             # "apple & elderflower" = napój, nie jabłko
    "butter chicken",          # indyjskie danie — nie masło
    "mintoes", "mints pack",   # cukierki miętowe — nie masło
    "humbugs",                 # "mint humbugs" = cukierki, nie zioło mint
    "seal bars",               # "mint seal bars" = baton czekoladowy
    "stir fry",                # "mushroom stir fry" = gotowe danie
    "pasty", "pasties",        # "cheese & onion pasty" = gotowe ciasto/pieróg
    "macaroni cheese",         # "pasta & sauce macaroni cheese" = gotowe danie
    "mac & cheese",            # analogicznie
    "fromage frais",           # serki owocowe — nie pojedynczy owoc
    "flavour thick",           # "apricot flavour thick yogurt" = jogurt z smakiem, nie owoc
    "basted",                  # "butter basted chicken" = marynowany kurczak, nie masło
    "wheats", "wheat cereal",  # "apricot fruit wheats" = płatki, nie owoc
    "fruit wheats",
    "lolly", "lollies",        # "almond mono lolly" = lód na patyku
    "double strength",         # napoje squash: "double strength apple & blackcurrant squash"
    "squirty squash",          # skoncentrowane napoje squash
    "squashies",               # cukierki drumstick squashies
    "mixed fruit squash",      # "mixed fruit squash" = napój
    "fruit & barley",          # "fruit & barley squash" = napój
    "juice drink",             # "cranberry juice drink" = napój, nie składnik
    "yogurt granola",          # "blueberry yogurt granola" = granola, nie jogurt
    "yogurt bars", "yogurt bar",  # "yogurt & strawberry bars" = baton, nie jogurt
    "caramel layered yogurt", "layered yogurt",  # jogurt z karmelem = deser
    "kefir yogurt",            # kefir to nie zwykły jogurt
    "cereal hoops",            # "honey cereal hoops" = płatki śniadaniowe, nie miód
    "dauphinoise",             # "potato dauphinoise" = gotowe danie, nie ziemniaki
    "brioche swirls", "brioche roll",  # "raisin brioche swirls" = ciasto, nie rodzynki
    "sausage & mash",          # gotowe danie, nie kiełbasa
    "rollitos",                # "Chorizo & Cheddar Rollitos" = przekąska, nie chorizo
    "sourdough pizza", "wood fired pizza", "nduja",  # gotowa pizza
    "chive dip", "cheese dip", "sour cream dip",  # gotowe dipy, nie śmietana
    "complimints", "sugar free strawberry",  # cukierki, nie owoc
    "breaded prawns", "breaded prawn",       # "sriracha breaded prawns" = gotowe danie
    " pizza",                                # wszystkie pizze = gotowe danie (ze spacją żeby nie łapać "pizza sauce")
    "jelly beans", "jelly bean",             # cukierki, nie fasola
    "pasta bake",                            # "tomato & pesto pasta bake" = gotowe danie
    "side salad",                            # "tomato & basil side salad" = gotowa sałatka
]

# PL keywords (Auchan / Biedronka) — kompletne dania gotowe do spożycia
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
    "deser ",          # "deser mleczno ryżowy" itp.
    "baton ",          # batoniki energetyczne
    "batonik",
    "vitanella",
    "frytki",          # gotowe frytki (nie surowy ziemniak/batat)
    "chipsy",
    "paluszki",
    "precel",
    "lody ",           # lody wszelkiego rodzaju
    "tortellini",
    "müllermilch",
    "zapiefix",
    "toffifee",
    "chili sin carne",
    "napój jogurtowy",
    "nesquik snack",
    "carmelove",     # Felix Carmelove — brandowe słodzone orzechy
    "cheerios",      # Nestlé Cheerios — płatki śniadaniowe z marki
    "natural mix",   # Plony Natury mix — wieloskładnikowy produkt brandowy
    "actimel",       # Danone Actimel — napój probiotyczny
]

# Marki wyłącznie gotowych dań (PL)
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

# EN składniki które NIE są gotowymi daniami mimo podejrzanych słów
WHITELIST_PATTERNS_PL = [
    r"^wątroba\b",       # wątroba = liver (składnik)
    r"^szynka\b",        # szynka = ham (składnik)
    r"curry\s*\d",       # "curry 50g" = przyprawa
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


# ── Domyślne wagi dla produktów na sztuki ────────────────────────────────────

def _load_default_weights() -> dict:
    path = HERE.parent / "data" / "default_weights.json"
    if path.exists():
        data = json.loads(path.read_text("utf-8"))
        return {k: v for k, v in data.items() if k != "_comment"}
    return {}

_DEFAULT_WEIGHTS = _load_default_weights()


def _default_weight_for(name: str) -> int | None:
    """Zwraca domyślną wagę (g) dla produktu na sztuki, szukając po słowach kluczowych."""
    name_l = name.lower()
    # Próbuj od najdłuższego dopasowania (np. "red grapefruit" przed "grapefruit")
    best_key = None
    best_len = 0
    for key in _DEFAULT_WEIGHTS:
        if key in name_l and len(key) > best_len:
            best_key = key
            best_len = len(key)
    if best_key:
        return _DEFAULT_WEIGHTS[best_key]
    return _DEFAULT_WEIGHTS.get("default")


# ── 2b. Gramatura ALDI ────────────────────────────────────────────────────────

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

    # 2. price_per_kg exists → oblicz gramaturę
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

    # 3. pack_volume ze scrapera (np. "0.5 L (£4.38/1 L)" → pack_volume=500, unit="ml")
    elif pack_volume and pack_vol_unit:
        pkg_val = pack_volume
        unit    = pack_vol_unit
        per_100 = round(price / pack_volume * 100, 4) if (price and pack_volume) else None

    # 4. price_per_litre → oblicz objętość
    elif ppl and price is not None:
        ml = round(price / ppl * 1000, 0)
        pkg_val = ml
        unit    = "ml"
        per_100 = round(price / ml * 100, 4) if ml else None

    # 5. Gramatura w description lub nazwie
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

    # 6. pcs bez wagi → użyj default_weights.json
    if unit == "pcs" and per_100 is None and price is not None:
        default_g = _default_weight_for(name)
        if default_g:
            per_100 = round(price / pkg_val / default_g * 100, 4) if pkg_val else round(price / default_g * 100, 4)

    # Produkty na wagę wg nazwy (świeże warzywa/owoce/ryby/mięso)
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


# ── 2c. Gramatura Auchan / Biedronka ─────────────────────────────────────────

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
        # Sprzedawane na sztuki — price_per_100 = None (nie porównujemy per 100g)
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


# ── 2d. Normalizacja nazw ─────────────────────────────────────────────────────

# ── EN (ALDI) ──────────────────────────────────────────────────────────────────

_REMOVE_PHRASES_EN = [
    r"specially selected", r"ripe\s*&\s*ready", r"free[\s-]range",
    r"wild[\s-]caught", r"grass[\s-]fed", r"grain[\s-]fed", r"corn[\s-]fed",
    r"full[\s-]fat", r"reduced[\s-]fat", r"low[\s-]fat", r"non[\s-]fat",
    r"fat[\s-]free", r"ready[\s-]to[\s-]eat", r"pre[\s-]cooked",
    r"family\s+pack", r"twin\s+pack", r"value\s+pack",
    r"rspca\s+assured", r"red\s+tractor",
    r"aberdeen\s+angus", r"ibérico", r"iberico",
    # Odmiany jabłek/gruszek — nie zmieniają kategorii produktu
    r"pink\s+lady", r"granny\s+smith", r"golden\s+delicious",
    r"braeburn", r"bramley", r"gala\b", r"fuji\b", r"jazz\b", r"cox\b",
    r"conference\b",  # gruszka Conference
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
    "fruit & nut",          # Cadbury Fruit & Nut = baton, nie "fruit" + "nut"
    "nuts & raisins",       # trail mix
    "cheese & onion",       # pasty filling — joined so "onion" nie staje sie osobnym produktem
}

# When the part AFTER & is a main protein, the & is a flavor separator, not a compound
_PROTEIN_KW = re.compile(
    r"\b(loin|steak|breast|thigh|fillet|mince|ground|salmon|cod|haddock|"
    r"prawn|shrimp|lamb|chicken|beef|pork|turkey|belly|rib|wing|rasher|chop)\b"
)

_FISH_KW = re.compile(r"\b(salmon|haddock|mackerel|trout|herring|kipper|cod)\b")
_BEEF_KW = re.compile(r"\b(beef|rump|sirloin|ribeye|rib-eye)\b")


# Nazwy produktów, które są normalizowane błędnie (zbyt agresywne usunięcie brandu lub
# konwersja mince→ground powoduje zbyt generyczny wynik). Klucz = lowercased original name.
_NORMALIZE_OVERRIDES_EN: dict[str, str] = {
    "quorn mince": "quorn mince",
}

# Znane rozmiary opakowań dla produktów, których Aldi nie wyświetla per-kg/per-L na stronie.
# Klucz = generic_name po normalizacji. Wartość = (rozmiar, jednostka)
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

# Znane marki które pojawiają się na POCZĄTKU nazwy produktu — usuwamy prefiks
# (sortuj od najdłuższego do najkrótszego żeby "bakad'or sélection" był przed "bakad'or")
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
    "americana",   # "Americana Tuńczyk z Warzywami" — analogicznie do Mexicana
    "teekanne",
    "top",
    "winiary",     # Winiary majonez, sos, ketchup → zostaje sam produkt
    "pewni dobrego",  # Premium brand Auchan → bardzo drogie, nie reprezentatywne
], key=len, reverse=True)

# Słowa marketingowe/brandowe usuwane NA ORYGINALNEJ PISOWNI (przed detekcją marki)
_MARKETING_PL_CASED = [
    r"\bBIO\b", r"\bEKO\b", r"\bBio\b", r"\bEko\b",
    r"\bPremium\b", r"\bExtra\b", r"\bSuper\b",
    r"\bKlasyczn\w*\b", r"\bNaturalny\b", r"\bNaturalna\b", r"\bNaturalne\b",
    r"\bLight\b", r"\bMAP\b",
    r"\bVital\b", r"\bFresh\b",
    r"\bXL\b", r"\bXXL\b",
    r"\bReady\b", r"\bTo\b", r"\bEat\b",  # "Ready To Eat" angielskie
]

# Substytucje i kanonizacja (przed normalizacją, case-insensitive)
_SUBSTITUTIONS_PL = [
    (r"\bpomidork\w+\b",            "pomidor"),
    (r"\bbatatat\w*\b",             ""),
    (r"\bstevia\b",                 "stewia"),   # EN spelling → PL
    (r"\berytrol\b",                "erytrytol"),
    # Sery żółte: kolejność ma znaczenie!
    # 1. cheddar standalone → "ser" (bo nie ma przed nim "ser żółty")
    (r"\bcheddar\b",               "ser"),
    # 2. usuń typ sera z "ser żółty [typ]" — zostaje samo "ser żółty"
    (r"\b(?:gouda|edam(?:ski\w*)?|maasd\w*|emment\w*|tilit\w*|morbi\w*|conte\w*)\b", ""),
    # 3. ser żółty (po usunięciu typu) → "ser"
    (r"\bser\s+żółty\b",           "ser"),
    (r"\bxylitol\b|\bksylitol\b",   "ksylitol"),
    (r"\bquinoa\b",                 "komosa ryżowa"),
    (r"\bedamame\b",                "edamame"),
]

# Wzorce usuwające opis kulinarny i geograficzny (po lowercase)
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
    r"\bpochodzenia\s+\w+\b",       # "naturalnego pochodzenia"
    r"\bz\s+inuliną\b",             # "z inuliną" — dodatek funkcjonalny
    r"\bsłodzik\w*\b",              # "słodzik stołowy" → usuń "słodzik", zostaje "erytrytol"
    r"\bstołow\w*\b",               # "stołowy" (słodzik stołowy)
    r"\bkaliber\s*\d*\b",            # "kaliber 12" / "kaliber" — rozmiar owocu
    r"\bkwasow\w*\b.*",              # "kwasowość/kwasowości 5%" itp. — techniczny parametr octu
    r"\bz\s+witaminą\b.*",           # "z witaminą D tłoczony na zimno" → usuń
    r"\btłoczon\w*\s+na\s+zimno\b",  # "tłoczony na zimno" — technologia
    r"\bśredni\b(?!\s+tłust)",      # "średni" jako rozmiar, nie tłustość
    r"\bekstra\b",                  # "śmietana ekstra kremowa" → "śmietana kremowa"
    r"\bkremow\w*\b",               # "śmietana kremowa" → "śmietana"
    r"\błagodny\b",                 # "ketchup łagodny" → "ketchup"
    r"\bpikantny\b",                # "ketchup pikantny" → "ketchup"
    r"\bkremsk\w*\b",               # "musztarda kremska" → "musztarda"
    r"\bfrancusk\w*\b",             # "musztarda francuska" → "musztarda"
    r"\btusz\w*\b",                 # "makrela tusza" → "makrela" (ryba)
    r"\bplastry\b",                 # "łosoś plastry" → "łosoś" (forma krojenia)
    r"\bw\s+plastrach\b",           # "ser żółty w plastrach" → "ser żółty"
    r"\btarty\b",                   # "ser żółty tarty" → "ser żółty" (forma starcia)
    r"\bkulka\b", r"\bkulki\b",     # "mozzarella kulka" → "mozzarella"
    r"\bnorwesk\w*\b",              # "łosoś norweski" → "łosoś" (geographic)
    r"\batlantycki\w*\b",           # "dorsz atlantycki" → "dorsz" (geographic)
    r"\bpolędwica\b",               # "dorsz polędwica" → "dorsz" (forma filetu ryby, nie wieprzowiny)
    r"\bz\s+tofu\b",                # "pesto z tofu" → "pesto"
    r"\bz\s+\w+skich\s+upraw\b.*",  # "z europejskich upraw" → usuń
    # suszone/cięte celowo zachowujemy — "jabłka suszone" ≠ "jabłka" (świeże)
    r"\bw\s+kryształkach\b",        # "w kryształkach" — forma
    r"\bkrystaliczn\w*\b",
    r"\bgranulat\w*\b",             # "granulowany"
    r"\bsypk\w*\b",                 # "sypki"
]

# Kwalifikatory odmianowe/opisowe warzyw i owoców (po lowercase)
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
    r"\blub\s+\w+\b",              # "lub X" (alternatywa)
    r"\bśredni\b",                 # rozmiar owocu
    r"\bdrobny\b", r"\bdrobne\b",
    r"\bwielk\w*\b",               # "wielkości"
    r"\bróżyczki\b",               # "brokuły różyczki" → "brokuły"
    r"\bsułtański\w*\b",           # "rodzynki sułtańskie" → "rodzynki"
    r"\btypu\s+islandzkiego\b",    # "skyr jogurt typu islandzkiego" → "skyr jogurt"
    r"\błuskan\w*\b",              # "migdały łuskane" → "migdały"
    r"\bblanszow\w*\b",             # "migdały blanszowane/blanszowany" → "migdały"
    r"\bw\s+płatkach\b",           # "migdały w płatkach" → "migdały"
    r"\bdługoziarnist\w*\b",       # "ryż długoziarnisty" → "ryż"
    r"\bkrótkoziarnist\w*\b",      # analogicznie
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
    r"\bkonserwow\w*\b",   # konserwowy/konserwowa/konserwowe — forma opakowania
    r"\bsuperfoods?\b",     # "Superfoods" — marketing
    r"\bsmooth\b",          # "masło orzechowe smooth" → "masło orzechowe"
    r"\bcrunchy\b",         # analogicznie
    # Nazwy sklepów (mogą pojawić się w nazwie produktu jako lowercase)
    r"\bauchan\b", r"\bbiedronka\b", r"\blidl\b", r"\bnetto\b",
    # Słowa kategorii sklepowych
    r"\bowoce\b", r"\bwarzywa\b", r"\bnabiał\b", r"\bpieczywo\b",
    # Standalone jednostki bez liczby (pozostałość po usunięciu "1 kg" itp.)
    r"\bkg\b", r"\bszt\b", r"\bg\b", r"\bml\b",
    # "opak." leftover po usunięciu gramatury
    r"\bopak\.?\b",
]

# Trailing prepositions/connectors
_TRAILING_PL = re.compile(r"\s+\b(z|ze|i|oraz|do|na|w|od|po|przy|dla|lub)\s*$", re.I)

# ── Meat canonicalization (PL) ────────────────────────────────────────────────

# Dopasuj zwierzę → polska nazwa mięsa
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

# Części ciała drobiu — substring match (unikamy problemów z \b i polskimi znakami)
# Uwaga: "pierś" (mianownik) ≠ "piersi" (dopełniacz) — to różne znaki ('ś' vs 'si')
_POULTRY_PARTS = [
    (re.compile(r"piersi|pierś"),   "pierś"),       # z piersi / pierś z
    (re.compile(r"\bfilet\w*\b"),   "pierś"),       # filet = pierś
    (re.compile(r"szyja"),          "szyja"),       # szyja z indyka/kurczaka → szyja (nie indyk)
    (re.compile(r"udka|udziec"),    "udka"),
    (re.compile(r"skrzydełk"),      "skrzydełka"),
    (re.compile(r"nóżk"),           "nóżki"),
    (re.compile(r"polędwiczk"),     "polędwiczka"),
]

# Organy — NIE są mięśniem, nie przechodzą przez canonicalizację
_ORGAN_MEATS_PL = re.compile(
    r"\b(wątrob\w+|wątróbk\w+|serc\w+|nerk\w+|flak\w*|podróbk\w+|"
    r"żołąd\w+|ozór\w*|móżdżek)\b"
)

# Słowa-wskaźniki że to produkt mięsny (nie warzywny czy inny)
_MEAT_INDICATORS = re.compile(
    r"\b(mięso|mięs\w+|schab|żeberek|żeberka|szynka|polędwic\w+|karkówka|"
    r"boczek|łopatka|udziec|filet|pierś|udka|skrzydełka|nóżki|"
    r"wołow\w+|wieprzow\w+|cielęc\w+|barani\w+|jagnięc\w+|"
    r"kurczak\w*|kaczk\w*|gęsi?\b|indyk\w*)\b"
)


def _canonicalize_meat_pl(name: str) -> str:
    """
    Jeśli nazwa dotyczy mięsa — sprowadź do kanonicznej formy:
      - organy (wątroba, serce, nerki): zwróć bez zmian
      - drób: [pierś/udka/skrzydełka/nóżki/polędwiczka] z [kurczaka/...]
      - inne: [mielona]? + [wołowina/wieprzowina/...]
    """
    if not _MEAT_INDICATORS.search(name):
        return name

    # Organy — zwróć TYLKO nazwę organu (bez "z kurczaka" itp.)
    # żeby "żołądki z kurczaka" nie matchowało "filet z kurczaka" przy fuzzy
    m = _ORGAN_MEATS_PL.search(name)
    if m:
        return m.group(0)  # np. "żołądki", "wątroba", "serce"

    is_ground = bool(re.search(r"\bmielon\w+\b", name))

    # Wykryj zwierzę
    animal = None
    for pattern, canonical in _ANIMAL_PL:
        if pattern.search(name):
            animal = canonical
            break

    if not animal:
        return name  # nie rozpoznano — nie zmieniaj

    if animal in _POULTRY:
        if is_ground:
            return f"mielony {animal}"
        genitive = {"kurczak": "kurczaka", "kaczka": "kaczki",
                    "gęś": "gęsi", "indyk": "indyka"}
        gen = genitive.get(animal, animal)
        # Szukaj części ciała
        for pattern, part in _POULTRY_PARTS:
            if pattern.search(name):
                return f"{part} z {gen}"
        # Brak konkretnej części — sam drób
        return animal
    else:
        # Wołowina, wieprzowina itd. — zachowaj konkretny kawałek jeśli wymieniony
        if is_ground:
            return f"mielona {animal}"
        # Kawałki mięsne — nie sprowadzaj do nazwy zwierzęcia
        _MEAT_CUTS = [
            (re.compile(r"\bporcja\s+rosołow\w*\b"),     "porcja rosołowa"),  # nie generic mięso!
            (re.compile(r"\bżeberek|żeberka\b"),         "żeberka"),
            (re.compile(r"\bschab\b"),                   "schab"),
            (re.compile(r"\bkarkówk\w*|karkow\w*"),      "karkówka"),
            (re.compile(r"\bboczek\b"),                  "boczek"),
            (re.compile(r"\budzi\w+\b"),                 "udziec"),
            (re.compile(r"\brostbef\w*|rostbeef\w*"),    "rostbef"),
            (re.compile(r"\bantryk\w+\b"),                "antrykot"),
            (re.compile(r"\bnogi\b"),                    "nogi wieprzowe"),  # nie "wieprzowina"
            (re.compile(r"\bgolonk\w+\b"),               "golonka"),
        ]
        for pattern, cut in _MEAT_CUTS:
            if pattern.search(name):
                return cut
        return animal


def normalize_name_pl(name: str) -> str:
    """Best-effort normalizacja polskiej nazwy produktu."""

    # 1. Remove "ok. N", "na wagę", package size, bare "sztuka"
    n = re.sub(r"\bok\.?\s*\d+", " ", name, flags=re.I)
    n = re.sub(r"\bna\s+wagę\b", " ", n, flags=re.I)
    n = re.sub(r"\b\d+(?:[.,]\d+)?\s*(g|kg|ml|l|szt|sztuk|cl)\b", " ", n, flags=re.I)
    n = re.sub(r"\bsztuka\b", " ", n, flags=re.I)

    # 2. Remove % patterns (brak \b po % bo % to nie word-char — "100% jabłko" → " jabłko")
    n = re.sub(r"\b\d+(?:[.,]\d+)?\s*%", " ", n)

    # 3. Substitutions (diminutywy, synonimy)
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

    # 6. Mięso — sprowadź do: [mielona] + zwierzę (+ część ciała dla drobiu)
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


# ── 2e. Deduplikacja ──────────────────────────────────────────────────────────

def deduplicate(products: list[dict]) -> list[dict]:
    """Dla każdego generic_name zostaw najtańszy po price_per_100 (lub price_per_unit)."""
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


# ── Budowanie rekordów wynikowych ─────────────────────────────────────────────

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

        # Fallback: dla produktów bez price_per_100, sprawdź znane rozmiary opakowań
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
        log.info(f"ALDI: odfiltrowano {filtered} gotowych dań")
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
        log.info(f"{shop}: odfiltrowano {filtered} gotowych dań")
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
            "title": "Statystyki normalizacji",
            "stats": {
                "Aldi (raw)":                 len(aldi_raw),
                "Auchan (raw)":               len(auchan_raw),
                "Biedronka (raw)":            len(biedronka_raw),
                "Aldi → records":             len(aldi_records),
                "Auchan → records":           len(auchan_records),
                "Biedronka → records":        len(biedronka_records),
                "shops_en (po dedup)":        len(shops_en),
                "shops_pl (po dedup)":        len(shops_pl),
                "EN z ceną (price_per_100)":  en_with,
                "EN bez ceny":                len(aldi_records) - en_with,
                "PL z ceną (price_per_100)":  pl_with,
                "PL bez ceny":                len(pl_records) - pl_with,
            },
            "rows": [],
        },
        {
            "title": "EN — produkty Aldi (original_name | generic_name | unit | price_per_100)",
            "rows": [row_en(r) for r in sorted(aldi_records, key=lambda x: x.get("generic_name", ""))],
            "limit": 500,
        },
        {
            "title": "PL — produkty (shop | original_name | generic_name | unit | price_per_100)",
            "rows": [row_pl(r) for r in sorted(pl_records, key=lambda x: x.get("generic_name", ""))],
            "limit": 500,
        },
    ]
    write_report(2, "normalize_shops", sections)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    outputs = [
        DATA / "aldi_normalized.json",
        DATA / "auchan_normalized.json",
        DATA / "biedronka_normalized.json",
        DATA / "shops_en.json",
        DATA / "shops_pl.json",
    ]
    if all(f.exists() for f in outputs):
        log.info("Wszystkie pliki wynikowe już istnieją. Pomijam krok 2.")
        return

    aldi      = json.loads((DATA / "aldi_products.json").read_text("utf-8"))
    auchan    = json.loads((DATA / "auchan_products.json").read_text("utf-8"))
    biedronka = json.loads((DATA / "biedronka_products.json").read_text("utf-8"))

    log.info(f"Aldi: {len(aldi)}, Auchan: {len(auchan)}, Biedronka: {len(biedronka)}")

    aldi_records      = build_aldi_records(aldi)
    auchan_records    = build_pl_records(auchan, "auchan")
    biedronka_records = build_pl_records(biedronka, "biedronka")

    log.info(f"Po normalizacji — Aldi: {len(aldi_records)}, "
             f"Auchan: {len(auchan_records)}, Biedronka: {len(biedronka_records)}")

    def save(path, data):
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), "utf-8")
        log.info(f"Zapisano {len(data)} → {path.name}")

    save(DATA / "aldi_normalized.json",      aldi_records)
    save(DATA / "auchan_normalized.json",    auchan_records)
    save(DATA / "biedronka_normalized.json", biedronka_records)

    shops_en = deduplicate(aldi_records)
    shops_pl = deduplicate(auchan_records + biedronka_records)
    save(DATA / "shops_en.json", shops_en)
    save(DATA / "shops_pl.json", shops_pl)

    log.info(f"shops_en: {len(shops_en)} unikalnych, shops_pl: {len(shops_pl)} unikalnych")

    _write_debug(aldi, auchan, biedronka,
                 aldi_records, auchan_records, biedronka_records,
                 shops_en, shops_pl)


if __name__ == "__main__":
    main()
