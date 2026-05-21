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
]

# PL keywords (Auchan / Biedronka) — kompletne dania gotowe do spożycia
READY_TO_EAT_PL = [
    "danie ",          # "Danie w stylu...", "Danie z kurczakiem..." (spacja — nie "danie" na końcu)
    "lunchbox",
    "zapiekanka",      # zapiekanka z szynką itp. — gotowe danie
    "pielmieni",       # pierogi ruskie odmiana
    "sajgonk",         # mini sajgonki
    "pad thai",
    "paella",
    "bigos",
    "pierogi",         # gotowe pierogi (nie surowiec)
    "naleśnik",
    "kopytka",
    "gołąbki",
    "gyros",
    "sushi",
    "wrap ",
    "tortilla z",      # gotowa tortilla nadziewana
    "pizza",
    "z kluseczkami",   # "Kurczak z kluseczkami FRoSTA"
    "po azjatycku",
    "słodko-kwaśny",
    "curry z",         # "Curry z kurczakiem" (gotowe danie; nie "curry" jako przyprawa)
    "pad thai",
]

# Marki wyłącznie gotowych dań (PL)
READY_BRANDS_PL = ["froста", "frosta", "proste historie", "bistro ", "family fish"]

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


# ── 2b. Gramatura ALDI ────────────────────────────────────────────────────────

def extract_package_aldi(product: dict) -> dict:
    name        = product.get("name", "")
    price       = product.get("price")
    ppkg        = product.get("price_per_kg")
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
            per_100  = None  # no meaningful per-100g for pcs

    # 2. price_per_kg exists
    elif ppkg and price is not None:
        if abs(price - ppkg) < 0.01:
            # 3. Sold by weight (price == price_per_kg)
            pkg_val = 1000
            unit    = "ml" if _is_liquid(name, category) else "g"
            by_wt   = True
            per_100 = round(ppkg / 10, 4)
        else:
            # 2. Calculate from price ratio
            grams   = round(price / ppkg * 1000, 0)
            pkg_val = grams
            unit    = "ml" if _is_liquid(name, category) else "g"
            per_100 = round(price / grams * 100, 4) if grams else None

    # 4/5. Gramatura w description lub nazwie
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
}

# When the part AFTER & is a main protein, the & is a flavor separator, not a compound
_PROTEIN_KW = re.compile(
    r"\b(loin|steak|breast|thigh|fillet|mince|ground|salmon|cod|haddock|"
    r"prawn|shrimp|lamb|chicken|beef|pork|turkey|belly|rib|wing|rasher|chop)\b"
)

_FISH_KW = re.compile(r"\b(salmon|haddock|mackerel|trout|herring|kipper|cod)\b")
_BEEF_KW = re.compile(r"\b(beef|rump|sirloin|ribeye|rib-eye)\b")


def normalize_name_en(name: str, brand: str = None) -> list[str]:
    n = name.lower()

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

    # Split on & only when both parts are standalone ingredients
    # (not when & joins a flavoring to a main protein, e.g. "smoky paprika & garlic loin")
    results = [n]
    if " & " in n and n.strip() not in _NO_SPLIT_EN:
        parts = [p.strip() for p in n.split(" & ")]
        if len(parts) == 2 and all(len(p.split()) >= 1 for p in parts):
            p1, p2 = parts
            # Skip split if p2 is a protein and p1 is just a flavoring
            if _PROTEIN_KW.search(p2) and not _PROTEIN_KW.search(p1):
                results = [n.replace(" & ", " ")]
            else:
                results = parts

    results = [re.sub(r"\s+", " ", r).strip(" -,/") for r in results]
    results = [r for r in results if len(r) > 1]
    return results


# ── PL (Auchan / Biedronka) ──────────────────────────────────────────────────

# Słowa marketingowe/brandowe usuwane NA ORYGINALNEJ PISOWNI (przed detekcją marki)
_MARKETING_PL_CASED = [
    r"\bBIO\b", r"\bEKO\b", r"\bBio\b", r"\bEko\b",
    r"\bPremium\b", r"\bExtra\b", r"\bSuper\b",
    r"\bKlasyczn\w*\b", r"\bNaturalny\b", r"\bNaturalna\b", r"\bNaturalne\b",
    r"\bLight\b", r"\bMAP\b",
    r"\bVital\b", r"\bFresh\b",   # marka ziół (Vital Fresh Bazylia)
    r"\bXL\b",                    # rozmiar opakownia
]

# Substytucje przed normalizacją (diminutywy, błędy, synonimy)
_SUBSTITUTIONS_PL = [
    (r"\bpomidork\w+\b",   "pomidor"),    # pomidorki → pomidor
    (r"\bbatatat\w*\b",    ""),           # batatat → (usuń, zostaje "słodki ziemniak")
]

# Wzorce usuwające opis kulinarny i geograficzny (po lowercase)
_CULINARY_PATTERNS_PL = [
    r"\bna\s+gulasz\b",
    r"\bz\s+szynki\b",
    r"\bz\s+kością\b",
    r"\bbez\s+skóry\b",
    r"\bbez\s+kości\b",
    r"\brasy\b",              # "rasy Puławskiej" — po break zostaje samo "rasy"
    r"\bze?\s+ściółki\b",     # "ze ściółki" — opis chowu, nie nazwa składnika
    r"\bze?\s+sadu\b.*",      # "z sadu/sadów..." — origin description
    r"\bz\s+sadów\b.*",       # "z sadów z regionu..." — usuń do końca
    r"\bz\s+regionu\b.*",     # "z regionu..." — usuń do końca
    r"\bpicante\b",
    r"\bextra\b",
    r"\bwędzon\w*\b",         # wędzony/wędzona (przy mięsie)
]

# Kwalifikatory odmianowe/opisowe warzyw i owoców (po lowercase)
_PRODUCE_QUALIFIERS_PL = [
    r"\bmalinow\w*\b",        # malinowy (odmiana pomidora)
    r"\bcherry\b",            # pomidor cherry
    r"\bdaktylowy\b",         # pomidor daktylowy
    r"\bgałązk\w*\b",         # na gałązce
    r"\bpęczek\b",            # rzodkiewka pęczek
    r"\bsałatkow\w*\b",       # sałatkowe (ziemniaki)
    r"\bpolsk\w*\b",          # polskie (origin)
    r"\bkorzeń\b", r"\bkorzeni\b",
    r"\bbiał\w*\b",           # biała (odmiana — pietruszka biała)
    r"\bpiżmow\w*\b",         # dynia piżmowa → dynia
    r"\bpapryczkow\w*\b",     # pomidorki papryczkowe → pomidor
    r"\bszt\.\b",             # pozostałość po "1 szt."
]

_REMOVE_WORDS_PL = [
    r"\bbio\b", r"\beko\b", r"\bekologiczn\w*\b",
    r"\bpremium\b", r"\bklasyczn\w*\b", r"\blight\b",
    r"\bpełnotłust\w*\b", r"\bodtłuszczon\w*\b",
    r"\bchud\w*\b",
    r"\bwiejsk\w*\b",
    r"\bnaturalnie\b",
    r"\bśwież\w*\b",
]

# Trailing prepositions/connectors
_TRAILING_PL = re.compile(r"\s+\b(z|ze|i|oraz|do|na|w|od|po|przy|dla)\s*$", re.I)

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
    (re.compile(r"\bfilet\w*\b"),   "filet"),       # filet z kurczaka
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

    # Organy — nie normalizuj, zostaw oryginalną nazwę
    if _ORGAN_MEATS_PL.search(name):
        return name

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
        # Wołowina, wieprzowina itd.
        if is_ground:
            return f"mielona {animal}"
        return animal


def normalize_name_pl(name: str) -> str:
    """Best-effort normalizacja polskiej nazwy produktu."""

    # 1. Remove "ok. N", "na wagę", package size, bare "sztuka"
    n = re.sub(r"\bok\.?\s*\d+", " ", name, flags=re.I)
    n = re.sub(r"\bna\s+wagę\b", " ", n, flags=re.I)
    n = re.sub(r"\b\d+(?:[.,]\d+)?\s*(g|kg|ml|l|szt|sztuk|cl)\b", " ", n, flags=re.I)
    n = re.sub(r"\bsztuka\b", " ", n, flags=re.I)

    # 2. Remove % patterns
    n = re.sub(r"\b\d+(?:[.,]\d+)?\s*%\b", " ", n)

    # 3. Substitutions (diminutywy, synonimy)
    for pattern, repl in _SUBSTITUTIONS_PL:
        n = re.sub(pattern, repl, n, flags=re.I)

    # 4. Remove marketing words BEFORE brand detection (they can block lowercase detection)
    for m in _MARKETING_PL_CASED:
        n = re.sub(m, " ", n)

    n = re.sub(r"\s+", " ", n).strip()

    # 5. Brand detection
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

        pkg = extract_package_aldi(p)
        names = normalize_name_en(p.get("name", ""), p.get("brand"))

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


if __name__ == "__main__":
    main()
