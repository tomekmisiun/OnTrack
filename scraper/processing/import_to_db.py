#!/usr/bin/env python3
"""
Importuje przepisy i produkty z pipeline'u do bazy danych aplikacji.

Uruchomienie (przez Docker):
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

app = create_app()


# ── Helpers ───────────────────────────────────────────────────────────────────

def load(filename: str) -> list:
    path = DATA / filename
    if not path.exists():
        print(f"Brak pliku: {path}")
        return []
    return json.loads(path.read_text("utf-8"))


def strip_accents(s: str) -> str:
    """Usuwa polskie akcenty dla porównania: żryżowy → ryzowy."""
    return "".join(
        c for c in unicodedata.normalize("NFKD", s)
        if not unicodedata.combining(c)
    )


def dedup_key(name: str) -> str:
    """Klucz deduplicacji: lowercase + bez akcentów + oczyszczony."""
    return re.sub(r"\s+", " ", strip_accents(name.lower().strip()))


_EN_WORDS = re.compile(
    r"\b(easy|simple|meal prep|gluten.free|dairy.free|whole30|paleo|keto|aip|"
    r"minute rice|the |and |with |cups?|tbsp|recipe)\b", re.I
)
_PL_LETTERS = re.compile(r"[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]")


def is_english_name(name: str) -> bool:
    """Zwraca True jeśli nazwa wygląda na angielską (nie powinna być w PL DB)."""
    return bool(_EN_WORDS.search(name)) and not _PL_LETTERS.search(name)


# Kolaps rodzin produktów — wiele wariantów → jedna prosta nazwa
_FAMILY_RULES: list[tuple[re.Pattern, str]] = [
    # Makarony — wszystko to "makaron"
    (re.compile(r"^makaron\b"),                "makaron"),
    # Ryż
    (re.compile(r"^ryż\b"),                    "ryż"),
    # Płatki
    (re.compile(r"^płatki owsiane|^owsian"),   "płatki owsiane"),
    # Warzywa i owoce — prefix match (bez \b na końcu, działa dla polskich deklinacji)
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
    # Nabiał — upraszczamy
    (re.compile(r"^mleko\b(?! kokosowe| migdałowe| owsiane)"), "mleko"),
    (re.compile(r"^jogurt\b(?! grecki)"),      "jogurt naturalny"),
    (re.compile(r"^ser\b(?! feta|parmezan|cheddar|mozzarella|twaróg|kozi|ricotta)"), "ser żółty"),
    (re.compile(r"^śmietana\b"),               "śmietana"),
    (re.compile(r"^twaróg\b(?! kremowy)"),     "twaróg"),
    # Mięso i drób
    (re.compile(r"^kurczak\b(?! mielony)"),    "kurczak"),
    (re.compile(r"^wieprzowina\b"),            "wieprzowina"),
    (re.compile(r"^wołowina\b"),               "wołowina"),
    # Rośliny strączkowe
    (re.compile(r"^fasola\b(?! czerwona|edamame)"), "fasola biała"),
    (re.compile(r"^soczewica\b"),              "soczewica"),
    # Słodziki — każdy to jedna nazwa
    (re.compile(r"^stewia\b|^stevia\b"),       "stewia"),
    (re.compile(r"^erytrytol\b|^erytrol\b"),   "erytrytol"),
    (re.compile(r"^ksylitol\b|^xylitol\b"),    "ksylitol"),
    # Oleje — upraszczamy DO podstawowej nazwy
    (re.compile(r"^olej z awokado"),               "olej z awokado"),
    (re.compile(r"^olej sezamowy"),                "olej sezamowy"),
    (re.compile(r"^olej kokosowy"),                "olej kokosowy"),
    (re.compile(r"^oliwa"),                        "oliwa z oliwek"),
    (re.compile(r"^olej roślinny|^olej rzepakowy|^olej słonecznikowy"), "olej roślinny"),
    # Buliony
    (re.compile(r"^bulion drobiowy\b|^rosół\b(?! wołowy)"), "bulion drobiowy"),
    (re.compile(r"^bulion wołowy\b"),          "bulion wołowy"),
    (re.compile(r"^bulion warzywny\b"),        "bulion warzywny"),
    # Wędliny i mięso przetworzone — wszystkie warianty → prosta nazwa
    (re.compile(r"^kiełbas\w*\b|^kielbas\w*\b"), "kiełbasa"),
    (re.compile(r"^boczek\b"),                 "boczek"),
    (re.compile(r"^szynka\b"),                 "szynka"),
    (re.compile(r"^bekon\b|^boczek\s+boczek"), "bekon"),
    # Sól — wszystkie typy to "sól"
    (re.compile(r"^sól\b|^sol\b"),             "sól"),
    # Sery
    (re.compile(r"^parmezan|^ser\s+parmezan|^parmigiano"),    "parmezan"),
    (re.compile(r"^mozzarella"),               "mozzarella"),
    (re.compile(r"^ser\s+feta|^feta"),         "ser feta"),
    (re.compile(r"^camembert"),                "camembert"),
    (re.compile(r"^brie"),                     "brie"),
    (re.compile(r"^ricotta"),                  "ricotta"),
    (re.compile(r"^mascarpone"),               "mascarpone"),
    # Czekolada
    (re.compile(r"^czekolada"),                "czekolada"),
    # Miód — wszystkie typy (wielokwiatowy, gryczany itp.) to "miód"
    (re.compile(r"^miód"),                     "miód"),
    # Ryby — upraszczamy do gatunku
    (re.compile(r"^łosoś(?! wędzony)"),        "łosoś"),
    (re.compile(r"^filet z łososia"),           "łosoś"),
    (re.compile(r"^dorsz"),                    "dorsz"),
    (re.compile(r"^tuńczyk"),                  "tuńczyk"),
    (re.compile(r"^krewetki"),                 "krewetki"),
    # Superfoods / pseudozboża
    (re.compile(r"^maca\b"),                   "maca"),
    (re.compile(r"^spirulina\b"),              "spirulina"),
    (re.compile(r"^komosa\b|^quinoa\b"),       "komosa ryżowa"),
    # Mąki
    (re.compile(r"^mąka\b(?! migdałowa| kokosowa| owsiana| z ciecierzycy)"), "mąka"),
    (re.compile(r"^mąka migdałowa\b"),         "mąka migdałowa"),
    (re.compile(r"^mąka kokosowa\b"),          "mąka kokosowa"),
    # Orzechy i nasiona
    (re.compile(r"^orzech\w*\s+włosk\w*\b"),   "orzechy włoskie"),
    (re.compile(r"^orzech\w*\s+nerkowc\w*\b"),  "orzechy nerkowca"),
    (re.compile(r"^orzech\w*\s+laskow\w*\b"),   "orzechy laskowe"),
    (re.compile(r"^orzech\w*\s+ziemn\w*\b|^masło orzechowe\b"), "masło orzechowe"),
    (re.compile(r"^migdał\w*\b"),              "migdały"),
    # Octy — rozróżniamy bo ceny różne
    (re.compile(r"^ocet jabłkowy\b"),          "ocet jabłkowy"),
    (re.compile(r"^ocet balsamiczny\b"),       "ocet balsamiczny"),
    (re.compile(r"^ocet\b(?! jabłkowy| balsamiczny| winny| ryżowy)"), "ocet"),
]


def collapse_family(name: str) -> str:
    """Sprowadza warianty produktu do prostej nazwy rodzinnej."""
    for pattern, canonical in _FAMILY_RULES:
        if pattern.match(name):
            return canonical
    return name


def build_macro_map(macros: list, key: str) -> dict:
    """Buduje słownik name_en/name_pl → makro (z wariantem bez akcentów)."""
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


def fuzzy_macro(name: str, macro_map: dict) -> dict:
    """Szuka makro po fuzzy match (rapidfuzz) jeśli nie ma dokładnego trafienia."""
    try:
        from rapidfuzz import process, fuzz
    except ImportError:
        return {}
    best = process.extractOne(
        name, macro_map.keys(),
        scorer=fuzz.token_sort_ratio, score_cutoff=75
    )
    if best:
        return macro_map[best[0]]
    return {}


def unit_to_app(unit: str | None) -> str:
    if unit == "pcs":
        return "szt"
    return unit or "g"


# Średnie wagi składników sprzedawanych na sztuki (pcs/szt → g)
# Źródło: średnie wagi warzyw i owoców dostępnych w polskich sklepach
_PCS_WEIGHT = {
    # Warzywa
    "batat": 200,        "bataty": 200,       "słodki ziemniak": 200,
    "ziemniak": 150,     "ziemniaki": 150,
    "cebula": 100,       "cebula biała": 100, "cebula czerwona": 100,
    "cebula dymka": 15,  "szalotka": 20,
    "czosnek": 5,        # cały główka ~40g, ale w przepisach "1 ząbek" = 5g
    "por": 150,
    "marchew": 80,       "marchewka": 80,
    "seler": 320,        "seler naciowy": 320, "łodyga selera": 40,  # 1 łodyga ≈ 40g
    "pietruszka": 80,    "korzeń pietruszki": 80,
    "burak": 150,        "buraki": 150,
    "pomidor": 120,      "pomidory": 120,
    "papryka": 150,      "papryka czerwona": 150, "papryka zielona": 150, "papryka żółta": 150,
    "ogórek": 250,       "ogórek świeży": 250,
    "cukinia": 300,      "kabaczek": 300,
    "bakłażan": 250,
    "dynia": 1500,       # kawałek dyni
    "kapusta": 1000,     "kapusta głowiasta": 1000,
    "brokuł": 400,       "kalafior": 600,
    "brukselka": 20,     # 1 różyczka
    "szpinak": 30,       # garść liści ≈ 30g
    "jarmuż": 30,
    "sałata": 200,       "mix sałat": 50,     # garść
    "kukurydza": 300,    # kolba
    "jalapeño": 15,      "jalapeno": 15,      "chili": 10,
    "awokado": 200,      "avocado": 200,
    # Owoce
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
    # Inne
    "jajko": 60,         "jajka": 60,         "egg": 60, "eggs": 60,
    "liść laurowy": 1,   "bay leaf": 1,
    "puszka": 400,       "can": 400,          # standardowa puszka
    "ziarnko pieprzu": 0.05,
}


def convert_weight(amount: float | None, ing_unit: str | None,
                   prod_unit: str, ing_name: str = "") -> float | None:
    if amount is None:
        return None
    iu = (ing_unit or "g").lower()
    pu = prod_unit.lower()

    # pcs → szt (countable items)
    if iu in ("pcs", "szt") and pu == "szt":
        return float(amount)

    # pcs → g: użyj domyślnej wagi jeśli produkt w gramach
    if iu in ("pcs", "szt") and pu == "g":
        key = ing_name.lower().strip()
        default_g = _PCS_WEIGHT.get(key, 100)
        return float(amount) * default_g

    # g ↔ ml: traktujemy 1:1 dla płynów
    if {iu, pu} <= {"g", "ml"}:
        return float(amount)

    return float(amount)


# ── Import produktów ──────────────────────────────────────────────────────────

def import_products(user_id: int, lang: str) -> dict[str, int]:
    """Importuje produkty — 1 produkt na unikalną nazwę (deduplikacja po akcentach)."""
    db_file   = "ingredient_db_en.json" if lang == "en" else "ingredient_db_pl.json"
    macro_key = "name_en"               if lang == "en" else "name_pl"

    ingredients = load(db_file)
    # Sortuj: produkty z price_per_100 najpierw (najtańsze), potem bez ceny
    # Dzięki temu kolaps rodzin bierze najtańszy produkt, nie pierwszy
    ingredients.sort(key=lambda x: (
        x.get("price_per_100") is None,   # None idzie na koniec
        x.get("price_per_100") or 9999,
    ))
    macro_map   = build_macro_map(load("ingredients_macros.json"), macro_key)

    # Grupuj po generic_name (nazwa produktu sklepowego) — to jest właściwy klucz
    # ingredient_name = specyficzna nazwa z przepisu ("makaron angel hair")
    # generic_name    = znormalizowana nazwa sklepowa ("makaron")
    # Chcemy 1 produkt per generic_name, ale product_map musi mapować OBA warianty

    seen: set[str] = set()   # dedup po generic_name key
    added = skipped_dup = skipped_en = 0
    product_map: dict[str, int] = {}

    for item in ingredients:
        ing_name     = item.get("ingredient_name", "").strip()
        generic_name = (item.get("generic_name") or ing_name).strip()

        if not ing_name:
            continue

        # Pomiń angielskie nazwy w PL imporcie (bez polskich liter + typowe EN słowa)
        if lang == "pl" and is_english_name(ing_name) and is_english_name(generic_name):
            skipped_en += 1
            continue

        # Produkt tworzony na podstawie generic_name, dalej upraszczany do rodziny
        # "makaron angel hair" → generic "makaron" → family "makaron" ✓
        prod_name = collapse_family(generic_name)
        prod_key  = dedup_key(prod_name)

        if prod_key in seen:
            # Produkt już istnieje — dodaj tylko mapowanie ingredient_name → prod_id
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

        # Makro: szukaj po generic_name, ingredient_name, bez akcentów, potem fuzzy
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
            kcal           = macro.get("kcal"),
            protein        = macro.get("protein"),
            fat            = macro.get("fat"),
            carbs          = macro.get("carbs"),
        )
        db.session.add(prod)
        db.session.flush()

        # Mapuj OBA warianty nazwy → ten sam product_id
        for k in (prod_name.lower(), prod_key, ing_name.lower(), dedup_key(ing_name)):
            product_map[k] = prod.id

        added += 1

    db.session.commit()
    print(f"  Produkty ({lang.upper()}): dodano {added}, "
          f"duplikaty={skipped_dup}, angielskie={skipped_en}")
    return product_map


# ── Import przepisów ──────────────────────────────────────────────────────────

def import_recipes(user_id: int, lang: str, product_map: dict[str, int]):
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

        recipe = Recipe(
            user_id   = user_id,
            name      = name[:100],
            image_url = r.get("image_url"),
            source_url= r.get("url"),
        )
        db.session.add(recipe)
        db.session.flush()

        for ing in r.get(ing_key, []):
            ing_name = (ing.get("name") or "").strip().lower()
            amount   = ing.get("amount")
            unit     = ing.get("unit")

            # Szukaj produktu — najpierw dokładnie, potem bez akcentów
            prod_id = product_map.get(ing_name) or product_map.get(dedup_key(ing_name))

            if not prod_id:
                # Utwórz placeholder
                placeholder = Product(
                    user_id=user_id, name=ing_name[:200],
                    price=0, package_weight=100, unit="g", sold_by_weight=False,
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
    print(f"  Przepisy ({lang.upper()}): dodano {added}, pominięto {skipped}, "
          f"placeholdery {placeholder_count}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="Import pipeline → DB")
    ap.add_argument("--user-id",     type=int, default=None)
    ap.add_argument("--lang",        default="en", choices=["en", "pl"])
    ap.add_argument("--clear",       action="store_true",
                    help="Usuń istniejące produkty i przepisy użytkownika przed importem")
    ap.add_argument("--list-users",  action="store_true")
    args = ap.parse_args()

    with app.app_context():
        if args.list_users:
            from app.models.user import User
            for u in User.query.all():
                prods   = Product.query.filter_by(user_id=u.id).count()
                recipes = Recipe.query.filter_by(user_id=u.id).count()
                print(f"  id={u.id}  {u.email:<35}  {prods} produktów, {recipes} przepisów")
            return

        if not args.user_id:
            print("Podaj --user-id N lub --list-users")
            sys.exit(1)

        uid = args.user_id

        if args.clear:
            r_count = Recipe.query.filter_by(user_id=uid).count()
            p_count = Product.query.filter_by(user_id=uid).count()
            # Kolejność: najpierw recipe_ingredients (FK), potem recipes, potem products
            recipe_ids = [r.id for r in Recipe.query.filter_by(user_id=uid).all()]
            if recipe_ids:
                RecipeIngredient.query.filter(
                    RecipeIngredient.recipe_id.in_(recipe_ids)
                ).delete(synchronize_session=False)
            Recipe.query.filter_by(user_id=uid).delete()
            Product.query.filter_by(user_id=uid).delete()
            db.session.commit()
            print(f"Usunięto: {r_count} przepisów, {p_count} produktów")

        print(f"Importuję dla user_id={uid}, lang={args.lang}...")
        product_map = import_products(uid, args.lang)
        import_recipes(uid, args.lang, product_map)
        print("Gotowe!")


if __name__ == "__main__":
    main()
