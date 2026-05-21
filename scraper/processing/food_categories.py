"""
Klasyfikator produktów spożywczych do 12 standardowych kategorii.

Działa dla produktów po polsku (Auchan, Biedronka) i angielsku (Aldi UK).
Używany przez wszystkie scrapery jako post-processing filter.

Użycie jako skrypt:
    python food_categories.py auchan_products.json      # filtruj + klasyfikuj
    python food_categories.py aldi_products.json --out aldi_classified.json
    python food_categories.py --stats auchan_products.json
"""

import json
import re
import sys
import argparse
from pathlib import Path

# ── 12 standaryzowanych kategorii ────────────────────────────────────────────
# Każda to (etykieta, [słowa kluczowe PL], [słowa kluczowe EN])
# Dopasowanie: ANY keyword w lowercase nazwie → ta kategoria

CATEGORIES: list[tuple[str, list[str], list[str]]] = [

    ("Nabiał i jaja", [
        "jaj", "jajk", "jajo", "żółtk", "białko jaj", "mleko", "mleka",
        "mleczn", "jogurt", "kefir", "maślank", "śmietan", "twaróg", "twarożek",
        "serek", "ser ", "sery", "feta", "mozzarella", "parmezan", "ricotta",
        "cheddar", "gouda", "brie", "camembert", "gruyere", "mascarpone",
        "skyr", "fromage", "cottage", "masło", "ghee", "butter", "śmietank",
        "nabiał", "ayran",
    ], [
        "egg", "eggs", "yolk", "milk", "oat milk", "almond milk", "coconut milk",
        "soy milk", "yogurt", "yoghurt", "kefir", "buttermilk", "cream",
        "cheddar", "mozzarella", "feta", "parmesan", "ricotta", "gouda",
        "brie", "camembert", "mascarpone", "cottage cheese", "cream cheese",
        "quark", "skyr", "butter", "ghee", "sour cream",
    ]),

    ("Mięso, drób i ryby", [
        "kurczak", "kurczaka", "pierś z kurczaka", "udo z kurczaka", "indyk",
        "wołowin", "wołowiny", "wołowe", "mielon", "stek", "polędwic",
        "antrykot", "rostbef", "udziec", "łopatk",
        "wieprzowi", "wieprzowa", "boczek", "szynk", "karkówk", "żeberk",
        "schab", "golonk", "kiełbas", "parówk", "kabanos",
        "łosoś", "dorsz", "tuńczyk", "halibut", "pstrąg", "mintaj",
        "makrela", "śledź", "sardynk", "krewetk", "małż", "ośmiornic",
        "kalmary", "ryb", "drób", "wędlin", "salami", "pepperoni",
        "prosciutto", "chorizo", "pancetta", "bresaola", "pasztet",
        "wątrób", "bulion mięs", "rosół",
    ], [
        "chicken", "turkey", "beef", "pork", "lamb", "veal",
        "steak", "mince", "minced", "ground beef", "ground pork",
        "bacon", "ham", "sausage", "salami", "pepperoni", "chorizo",
        "prosciutto", "pancetta", "bresaola", "pâté", "liver",
        "salmon", "cod", "tuna", "halibut", "trout", "mackerel",
        "herring", "sardine", "shrimp", "prawn", "mussel", "squid",
        "fish", "seafood", "poultry", "meatball", "meat",
    ]),

    ("Warzywa", [
        "szpinak", "jarmuż", "rukola", "sałat", "roszpunk",
        "brokuł", "kalafiory", "kalafior", "brukselk", "kapust",
        "marchew", "marchewk", "seler", "burak", "rzodkiew", "pasternak",
        "cukinia", "dynia", "kabaczek", "ogórek",
        "cebula", "czosnk", "por", "szalotk", "dymka",
        "fasolk", "fasolka", "groszek", "edamame",
        "pomidor", "papryka", "bakłażan", "ziemniak", "batat", "słodki ziemniak",
        "pieczark", "boczniak", "shiitake", "grzyb",
        "kapusta kiszon", "kiszon", "kimchi",
        "kukurydz", "warzywa", "warzywn", "jarzynow",
        "szparak", "karczochy", "bób", "kiełki",
    ], [
        "spinach", "kale", "rocket", "arugula", "lettuce", "salad leaves",
        "broccoli", "cauliflower", "brussels sprout", "cabbage", "coleslaw",
        "carrot", "celery", "beetroot", "beet", "radish", "parsnip",
        "courgette", "zucchini", "pumpkin", "squash", "cucumber",
        "onion", "garlic", "leek", "shallot", "spring onion",
        "green bean", "peas", "edamame", "sugar snap",
        "tomato", "pepper", "aubergine", "eggplant", "potato", "sweet potato",
        "mushroom", "shiitake", "portobello",
        "sauerkraut", "kimchi", "pickled",
        "corn", "sweetcorn", "vegetable", "veggies", "asparagus", "artichoke",
    ]),

    ("Owoce", [
        "borówk", "malina", "malin", "jeżyna", "truskawk", "jagod",
        "jabłko", "jabłk", "gruszk",
        "brzoskwini", "nektarynk", "śliwk", "wisni", "wiśni", "czereśni",
        "cytryn", "limonk", "pomarańcz", "grejpfrut", "mandarynk",
        "banan", "mango", "ananas", "papaj", "kiwi", "awokado",
        "rodzynk", "żurawin", "daktyle", "figi", "fig", "morel",
        "owoc", "owoce", "owocow",
        "granat", "melon", "arbuz", "kokos",
    ], [
        "blueberry", "raspberry", "blackberry", "strawberry", "berry",
        "apple", "pear",
        "peach", "nectarine", "plum", "cherry",
        "lemon", "lime", "orange", "grapefruit", "mandarin", "clementine",
        "banana", "mango", "pineapple", "papaya", "kiwi", "avocado",
        "raisin", "cranberry", "date", "fig", "apricot", "dried fruit",
        "fruit", "pomegranate", "melon", "watermelon", "coconut",
        "frozen fruit", "mixed berries",
    ]),

    ("Produkty zbożowe i mąki", [
        "płatki owsian", "płatki jagl", "płatki gryczane", "płatki ryżowe",
        "płatki kukurydz", "musli", "granola",
        "mąka pszenn", "mąka pełnoziarnist", "mąka orkiszow", "mąka żytni",
        "mąka migdałow", "mąka kokosow", "mąka ryżow", "mąka gryczana",
        "mąka z ciecierzycy", "mąka owsiana",
        "makaron", "spaghetti", "penne", "fusilli", "tagliatelle",
        "ryż biały", "ryż brązowy", "ryż jaśminow", "ryż basmati", "ryż do sushi",
        "quinoa", "kasza jagl", "kasza gryczana", "kasza pęczak", "kasza manna",
        "kuskus", "bulgur", "orkisz", "proso",
        "chleb", "bułk", "bagietk", "tortilla", "wrap", "pita", "naan",
        "płatki", "owsianka", "amarantus",
    ], [
        "oat", "oats", "granola", "muesli", "cornflakes", "cereal",
        "flour", "almond flour", "coconut flour", "rice flour", "oat flour",
        "pasta", "spaghetti", "penne", "fusilli", "noodle", "macaroni",
        "rice", "basmati", "jasmine rice", "brown rice",
        "quinoa", "millet", "buckwheat", "couscous", "bulgur", "amaranth",
        "bread", "roll", "bun", "wrap", "tortilla", "pita", "naan", "bagel",
        "cracker", "oatmeal", "porridge", "grains",
    ]),

    ("Orzechy, nasiona i masła orzechowe", [
        "migdały", "migdał", "orzech włoski", "nerkowce", "nerkowiec",
        "pekan", "laskow", "orzech",
        "chia", "siemię lnian", "sezam", "słonecznik", "pestki dyni",
        "pestki", "nasiona konopi", "nasiona",
        "masło orzechowe", "masło migdałow", "masło z nerkowców",
        "masło słonecznikow", "tahini", "pasta orzechow",
    ], [
        "almond", "walnut", "cashew", "pecan", "hazelnut", "nut", "nuts",
        "chia", "flaxseed", "linseed", "sesame", "sunflower seed",
        "pumpkin seed", "hemp seed", "seed",
        "peanut butter", "almond butter", "cashew butter",
        "nut butter", "tahini",
    ]),

    ("Tłuszcze, oleje i sosy", [
        "oliwa", "olej kokosow", "olej awokado", "olej sezamow",
        "olej ryżow", "olej rzepakow", "olej słonecznikow", "olej lnian",
        "olej", "smalec",
        "sos sojow", "tamari", "amino", "sos rybny", "worcestershire",
        "ocet jabłkow", "ocet białow", "ocet balsamiczn", "ocet ryżow", "ocet",
        "pasta pomidorow", "concentrat pomidorow", "passata",
        "pasta curry", "pasta miso", "harissa", "pesto",
        "majonez", "ketchup", "musztarda",
    ], [
        "olive oil", "coconut oil", "avocado oil", "sesame oil",
        "vegetable oil", "sunflower oil", "rapeseed oil", "lard",
        "soy sauce", "tamari", "coconut aminos", "fish sauce", "worcestershire",
        "apple cider vinegar", "balsamic", "rice vinegar", "vinegar",
        "tomato paste", "tomato puree", "passata",
        "curry paste", "miso paste", "harissa", "pesto",
        "mayonnaise", "ketchup", "mustard", "oil",
    ]),

    ("Słodziki i dodatki smakowe", [
        "cukier trzcinow", "cukier kokosow", "cukier puder", "cukier",
        "syrop klonow", "syrop z agawy", "syrop daktylowy", "syrop ryżow",
        "miód", "melasa", "stewia", "erytrytol", "ksylitol", "sukraloza",
        "ekstrakt waniliow", "aromat waniliow", "wanilia",
        "kakao", "czekolad", "chipsy czekolad",
    ], [
        "sugar", "caster sugar", "icing sugar", "brown sugar",
        "maple syrup", "agave", "date syrup", "honey", "molasses",
        "stevia", "erythritol", "xylitol", "sweetener",
        "vanilla extract", "vanilla", "cocoa", "chocolate chips",
        "dark chocolate", "cacao",
    ]),

    ("Przyprawy, zioła i proszki", [
        "bazylia", "oregano", "tymianek", "rozmaryn", "kolendra",
        "pietruszk", "mięta", "lubczyk", "estragon", "koperek",
        "cynamon", "kurkuma", "kumin", "kmin", "papryka mielona",
        "chili", "gałka muszkatołow", "imbir mielon", "kardamon",
        "czosnek granul", "cebula granul", "curry", "garam masala",
        "sól", "sol morska", "sól himalajsk", "pieprz", "ziele angielskie",
        "bulion", "kostka rosołow", "drożdże nieaktywn", "drożdże",
        "przyprawa", "zioła",
    ], [
        "basil", "oregano", "thyme", "rosemary", "coriander", "cilantro",
        "parsley", "mint", "dill", "tarragon", "chive",
        "cinnamon", "turmeric", "cumin", "paprika", "chilli", "chili",
        "nutmeg", "ginger", "cardamom", "clove", "allspice",
        "garlic powder", "onion powder", "curry powder", "garam masala",
        "salt", "sea salt", "himalayan salt", "black pepper", "pepper",
        "stock cube", "bouillon", "nutritional yeast", "yeast",
        "spice", "herb", "seasoning",
    ]),

    ("Produkty konserwowe i słoikowe", [
        "pomidor krojony", "pomidory krojone", "pomidory w puszce",
        "concentrat pomidor", "passata", "przecier pomidor",
        "ciecierzyca", "fasola czarna", "fasola czerwona", "fasola biała",
        "soczewica", "groch", "bób",
        "kukurydza konserw", "groszek konserw", "kapusta konserw",
        "grzyby konserw", "karczochy",
        "papryka marynowana", "ogórek konserw",
        "konserwa", "puszka", "słoik", "marynowa", "kompot", "dżem",
        "konfitura", "marmolada",
    ], [
        "canned tomato", "chopped tomato", "tomato tin", "tomato can",
        "tomato paste", "passata",
        "chickpea", "black bean", "kidney bean", "white bean",
        "lentil", "pea", "legume",
        "canned corn", "canned peas", "canned mushroom", "artichoke",
        "pickled pepper", "gherkin", "pickle",
        "canned", "tinned", "jar", "preserve", "jam", "compote",
        "marmalade", "conserve",
    ]),

    ("Białka i zamienniki", [
        "białko serwatk", "białko roślinne", "protein powder",
        "kolagen", "tofu", "tempeh", "seitan", "burger roślinny",
        "zamiennik jajk", "siemię lniane", "aquafaba",
        "mleko roślinne", "ser roślinny", "jogurt roślinny",
        "plant-based", "vege", "wegański", "bezglutenow",
        "paleo", "keto",
    ], [
        "whey protein", "plant protein", "protein powder", "collagen",
        "tofu", "tempeh", "seitan", "plant-based burger", "vegan meat",
        "egg replacer", "aquafaba",
        "vegan cheese", "vegan yogurt", "dairy-free",
        "gluten-free", "paleo", "keto", "protein",
    ]),

    ("Przekąski i produkty gotowe", [
        "chipsy", "chips", "krakersy", "paluszki", "popcorn",
        "baton", "batonik", "musli baton", "protein baton",
        "jerky", "suszone mięso",
        "mrożony burger", "mrożone krewetki", "mrożone warzywa",
        "gotowe danie", "danie gotowe",
    ], [
        "chips", "crisps", "crackers", "popcorn", "pretzel",
        "protein bar", "energy bar", "granola bar", "muesli bar",
        "jerky", "biltong", "beef jerky",
        "frozen meal", "ready meal",
    ]),
]


# ── Klasyfikator ──────────────────────────────────────────────────────────────

def _normalize(text: str) -> str:
    """Lowercase + usuń polskie znaki dla porównania."""
    t = text.lower()
    for a, b in [("ą","a"),("ć","c"),("ę","e"),("ł","l"),
                 ("ń","n"),("ó","o"),("ś","s"),("ź","z"),("ż","z")]:
        t = t.replace(a, b)
    return t


# Pre-kompiluj wzorce dla szybkości
_COMPILED: list[tuple[str, list[re.Pattern], list[re.Pattern]]] = []
for _label, _kw_pl, _kw_en in CATEGORIES:
    _pl = [re.compile(re.escape(_normalize(k))) for k in _kw_pl]
    _en = [re.compile(re.escape(k.lower())) for k in _kw_en]
    _COMPILED.append((_label, _pl, _en))


def classify(name: str, store_category: str = "") -> str | None:
    """
    Klasyfikuje produkt do jednej z 12 kategorii.
    Zwraca etykietę kategorii lub None jeśli nie pasuje.

    Args:
        name:           Nazwa produktu (PL lub EN)
        store_category: Oryginalna kategoria ze sklepu (opcjonalna, pomaga)
    """
    norm_name = _normalize(name)
    norm_cat  = _normalize(store_category)
    combined  = norm_name + " " + norm_cat

    for label, pl_patterns, en_patterns in _COMPILED:
        for pat in pl_patterns:
            if pat.search(combined):
                return label
        for pat in en_patterns:
            if pat.search(combined):
                return label

    return None


def classify_product(product: dict) -> dict | None:
    """
    Przyjmuje dict produktu (z dowolnego scrapera), klasyfikuje go
    i dodaje pole `standard_category`. Zwraca None jeśli nie pasuje.

    Obsługiwane formaty:
      Auchan/Biedronka: {name, price, ...}
      Aldi:             {name, category, price, ...}
      MealPrepOnFleek:  {name, category, ingredients, ...}
    """
    name     = product.get("name", "")
    cat      = product.get("category", "") or product.get("_category", "")
    standard = classify(name, str(cat))

    if standard is None:
        return None

    result = dict(product)
    result["standard_category"] = standard
    return result


# ── CLI: filtruj plik JSON ────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="Klasyfikuj i filtruj produkty do 12 kategorii")
    ap.add_argument("input",  help="Plik JSON z produktami (lista)")
    ap.add_argument("--out",  default=None,
                    help="Plik wyjściowy (domyślnie: input_classified.json)")
    ap.add_argument("--stats", action="store_true",
                    help="Tylko statystyki, bez zapisu")
    ap.add_argument("--show-unmatched", action="store_true",
                    help="Wypisz produkty bez kategorii")
    args = ap.parse_args()

    path_in  = Path(args.input)
    path_out = Path(args.out) if args.out else path_in.parent / (path_in.stem + "_classified.json")

    products = json.loads(path_in.read_text("utf-8"))
    print(f"Wczytano: {len(products)} produktów z {path_in.name}")

    matched   = []
    unmatched = []

    for p in products:
        result = classify_product(p)
        if result:
            matched.append(result)
        else:
            unmatched.append(p)

    by_cat: dict[str, int] = {}
    for p in matched:
        c = p["standard_category"]
        by_cat[c] = by_cat.get(c, 0) + 1

    print(f"\nDopasowane:    {len(matched)}  ({len(matched)/len(products)*100:.1f}%)")
    print(f"Niedopasowane: {len(unmatched)}")
    print(f"\nPodział na kategorie:")
    for cat, count in sorted(by_cat.items(), key=lambda x: -x[1]):
        print(f"  {count:4d}  {cat}")

    if args.show_unmatched:
        print(f"\nNiedopasowane (pierwsze 30):")
        for p in unmatched[:30]:
            print(f"  {p.get('name','?')[:60]}")

    if args.stats:
        return

    path_out.write_text(json.dumps(matched, ensure_ascii=False, indent=2), "utf-8")
    print(f"\nZapisano → {path_out}  ({len(matched)} produktów)")


if __name__ == "__main__":
    main()
