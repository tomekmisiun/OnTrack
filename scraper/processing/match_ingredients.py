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

# Aliasy składników — tłumaczenie przed matchowaniem
_INGREDIENT_CANONICAL_PL: dict[str, str] = {
    # Drób — generyczne → konkretna część
    "kurczak":              "pierś z kurczaka",
    "indyk":                "pierś z indyka",
    "filet z kurczaka":     "pierś z kurczaka",
    "filety z kurczaka":    "pierś z kurczaka",
    "filet z indyka":       "pierś z indyka",
    "żołądek z kurczaka":   "żołądki z kurczaka",
    # Ryby
    "tuńczyk":              "tuńczyk kawałki w sosie własnym",
    # Warzywa z mylącą nazwą
    "serca karczochów":     "karczochy",          # brak w sklepach → unmatch
    "serce karczocha":      "karczochy",
    "mieszanka sałat":      "mix sałat z roszponką",  # → mix sałat
    # Mięso — ogólne → konkretny produkt
    "wieprzowina":          "karkówka",           # schab/szynka/karczek = karkówka jest najbardziej neutralna
    "wołowina":             "wołowina",           # gulasz/udziec — zostawia jak jest (teraz sklep ma gulasz)
    "żeberka wołowe":       "żeberka",            # wołowe → wieprzowe (niedostępne w PL)
    "beef ribs":            "żeberka",
    # Colesław — "mieszanka" to za ogólne, "coleslaw" jest kluczem
    "mieszanka coleslaw":   "surówka colesław łagodna",
    "coleslaw":             "surówka colesław łagodna",
    "sałatka colesław":     "surówka colesław łagodna",
    # Inne
    "majonez":              "winiary majonez lekki",  # nie wegański
    # Suszone/liofilizowane — teraz są w bazie (auchan bakalie), nie blokuj
    # Kolor/odmiana → konkretny produkt sklepu
    "brązowy cukier":       "cukier trzcinowy",
    "biały cukier":         "cukier biały",
    "brązowy ryż":          "ryż brązowy",
    "biały ryż":            "ryż",
}
_INGREDIENT_CANONICAL_EN: dict[str, str] = {
    "chicken":              "chicken breast",
    "chicken fillet":       "chicken breast",
    "chicken fillets":      "chicken breast",
    "turkey":               "turkey breast",
    "tuna":                 "tuna chunks in spring water",
    "applesauce":           "apple sauce",
    "apple sauce":          "apple sauce",
    "beef broth":           "chicken stock",   # ALDI nie ma beef broth → chicken stock jako substytut
    "beef stock":           "chicken stock",
    "vegetable broth":      "vegetable stock",
    "chicken broth":        "chicken stock",
    "ground beef":          "beef mince",
    "ground pork":          "pork mince",
    "minced beef":          "beef mince",
    "minced pork":          "pork mince",
    "pork":                 "pork loin",
    "beef":                 "beef steak",  # generyczny beef → steak/cut nie mince
    # Berries — blueberries to odmiana berries
    "berries":              "blueberries",
    "mixed berries":        "blueberries",
    # Orzechy — liczba mnoga jest inna forma tokenu
    "almond":              "whole almonds",
    "cashew":              "cashews",
    "walnut":              "walnuts",
    "hazelnut":            "hazelnuts",
    "pecan":               "pecans",
    "nuts":                "mixed nuts",     # nie Cadbury Fruit & Nut
    # Owoce i warzywa — liczba mnoga / właściwy produkt
    "cranberry":           "cranberries",
    "blueberry":           "blueberries",
    "strawberry":          "strawberries",
    "raspberry":           "raspberries",
    "blackberry":          "blackberries",
    "lime":                "limes",          # nie "pineapple & lime" drink
    "lemon":               "lemons",
    "orange zest":         "oranges",        # zest = skórka → dopasuj do owocu
    "lemon zest":          "lemons",
    "lime zest":           "limes",
    "onion":               "brown onions",   # nie "cheese & onion pasty"
    # Zioła i przyprawy — nie cukierki/gotowe dania
    "mint":                "cut mint",       # nie "mint humbugs"
    "jalapeño":            "green jalapeños", # nie "jalapeño fusions tuna"
    "jalapeno":            "green jalapeños",
    "jalapeños":           "green jalapeños",
    "lemon pepper":        "lemon pepper seasoning niematch",  # ALDI nie ma → unmatch
    # Warzywa — singular/plural i specyfika
    "lentil":              "red lentils",    # nie "lentil chips"
    "mushroom":            "mushrooms",      # nie "mushroom stir fry"
    # Kimchi — ALDI nie ma czystego kimchi
    "kimchi":              "kimchi jar niematch",  # → unmatch
    # Sosy makaron — dopasuj do konkretnych słoikowych sosów, nie ready-to-cook kits
    "pasta sauce":         "bolognese pasta sauce",
    "tomato sauce":        "bolognese pasta sauce",
    # Przyprawy bez odpowiednika w ALDI
    "lemon pepper":        "lemon pepper seasoning niematch",  # → unmatch
    "orange zest":         "oranges",
    "lemon zest":          "lemons",
    "lime zest":           "limes",
    # Miód — "clear honey" lub "runny honey", nie "cereal hoops"
    # Nabiał — bezsmakowy jogurt naturalny
    "yogurt":              "fat free natural yogurt",
    "plain yogurt":        "fat free natural yogurt",
    "natural yogurt":      "fat free natural yogurt",
    "greek yogurt":        "greek style yogurt",
    "plain greek yogurt":  "greek style yogurt",
    # Kokos — desiccated, nie jogurt z kokosem
    "coconut":             "desiccated coconut",
    # Wino do gotowania — ALDI nie scrape'uje win, unmatch
    "white cooking wine":  "white cooking wine niematch",
    "red cooking wine":    "red cooking wine niematch",
    "cooking wine":        "cooking wine niematch",
    "dry white wine":      "dry white wine niematch",
    "dry red wine":        "dry red wine niematch",
    # Miód — "clear honey" lub "runny honey", nie "cereal hoops"
    "honey":               "clear honey",
    # Brzoskwinia — ALDI ma w puszce, nie świeże
    "peach":               "peach slices in juice",
    # Ziemniaki — nie "dauphinoise" ready meal
    "potato":              "potatoes",
    "potatoes":            "potatoes",
    # Rodzynki — nie "brioche swirls"
    "raisin":              "raisins",
    "raisins":             "raisins",
    # Kiełbasa/salceson — nie gotowe danie z purée
    "andouille sausage":   "sausages",
    "andouille":           "sausages",
    # Dynia — ALDI ma butternut squash, nie pestki
    "pumpkin":             "butternut squash",
    # Pie crust — ALDI nie ma → unmatch
    "pie crust":           "pie crust niematch",
    "pie shell":           "pie crust niematch",
    # Olive oil
    "olive oil":             "extra virgin olive oil",
    "evoo":                  "extra virgin olive oil",
    # Cilantro = coriander (EN/US vs UK naming)
    "cilantro":              "cut coriander",
    "fresh cilantro":        "cut coriander",
    "fresh coriander":       "cut coriander",
    # Zucchini = courgette
    "zucchini":              "courgettes",
    "zucchinis":             "courgettes",
    # Parmesan — ALDI nie ma samego → feta jako substytut twardego sera
    "parmesan":              "greek feta",
    "parmesan cheese":       "greek feta",
    # Feta
    "feta":                  "greek feta",
    "feta cheese":           "greek feta",
    # Green onion / spring onion
    "green onion":           "spring onion",
    "green onions":          "spring onion",
    "scallion":              "spring onion",
    "scallions":             "spring onion",
    # Turmeric
    "turmeric":              "ground turmeric",
    # Oregano — ALDI nie ma osobno → unmatch
    "oregano":               "oregano niematch",
    "dried oregano":         "oregano niematch",
    # Almond milk, ghee, hot sauce, salsa — ALDI nie ma → unmatch
    "almond milk":           "almond milk niematch",
    "almond flour":          "almond flour niematch",
    "coconut sugar":         "coconut sugar niematch",
    "almond butter":         "almond butter niematch",
    "ghee":                  "ghee niematch",
    "hot sauce":             "hot sauce niematch",
    "salsa":                 "salsa niematch",
    "sesame oil":            "sesame oil niematch",
    # Jasmine rice — ALDI ma ready-to-heat (nie surowy) → unmatch
    "jasmine rice":          "jasmine rice niematch",
    "extra virgin olive oil":"extra virgin olive oil",
    "light olive oil":       "extra virgin olive oil",
    # Pepper (spice) → ground black pepper
    "pepper":                "ground black pepper",
    "black pepper":          "ground black pepper",
    "ground pepper":         "ground black pepper",
    "freshly ground pepper": "ground black pepper",
    # Bell pepper → red pepper
    "bell pepper":           "red pepper",
    "red bell pepper":       "red pepper",
    "green bell pepper":     "red pepper",
    "yellow bell pepper":    "red pepper",
    "capsicum":              "red pepper",
    # Water — darmowe
    "water":                 "water",
    "warm water":            "water",
    "cold water":            "water",
    # Warzywa — generyczne → konkretny produkt ALDI
    "tomato":                "salad tomatoes",       # nie pizza
    "tomatoes":              "salad tomatoes",
    "vegetable":             "carrots",              # zbyt generyczne → marchew jako neutralne warzywo
    # Fasola — ALDI nie ma white/mixed beans, najbliższy = red kidney beans in water
    "white beans":           "red kidney beans in water",
    "white bean":            "red kidney beans in water",
    "cannellini beans":      "red kidney beans in water",
    "cannellini bean":       "red kidney beans in water",
    "navy beans":            "red kidney beans in water",
    "great northern beans":  "red kidney beans in water",
    "mixed beans":           "red kidney beans in water",
    "tomato paste":          "tomatoes in tomato juice",   # ALDI nie ma paste → canned tomatoes
    "tomato puree":          "tomatoes in tomato juice",
    "canned tomatoes":       "tomatoes in tomato juice",
    "crushed tomatoes":      "tomatoes in tomato juice",
    "diced tomatoes":        "tomatoes in tomato juice",
    # Suszone owoce — ALDI ma freeze-dried slices, nie świeże
    "freeze dried strawberries": "strawberry slices",
    "freeze dried strawberry":   "strawberry slices",
    # Śmietana — nie dip z cebulką
    "dairy free sour cream": "sour cream",
    "vegan sour cream":    "sour cream",
    # Chorizo wegańskie / sojowe — ALDI nie ma → unmatch
    "soy chorizo":         "soy chorizo niematch",
    "beyond meat spicy italian sausage": "beyond meat niematch",
    # Sriracha — ALDI nie ma samego sosu → unmatch
    "sriracha":            "sriracha niematch",
}

SCORE_AUTO      = 85
SCORE_UNCERTAIN = 100  # WYŁĄCZONE — tylko exacty/bliskie >= 85% przechodzą, reszta = NO_MATCH
UNCERTAIN_BATCH = 15
MAX_CANDIDATES  = 10
MAX_RETRIES     = 2

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger(__name__)


# ── Scoring ───────────────────────────────────────────────────────────────────

# Kwalifikatory dietetyczne — produkt wegański ≠ zwykły (gdy składnik nie wskazuje wegańskiego)
_DIETARY_QUALIFIERS = {"wegański", "wegańska", "wegańskie", "vegan"}


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

    # Przetworzona forma produktu ≠ surowy składnik:
    # "apricot jam" ≠ "apricot", "apple sauce" ≠ "apple" (jako surowy owoc)
    _PROCESSED_FORMS = {"jam", "jelly", "sauce", "preserve", "preserves", "conserve",
                        "conserves", "paste", "extract", "syrup", "concentrate",
                        "puree", "purée", "compote", "curd",
                        "yogurt", "yoghurt"}  # coconut sugar ≠ coconut yogurt
    if (meaningful_p & _PROCESSED_FORMS) and not (meaningful_i & _PROCESSED_FORMS):
        return tsr  # produkt to przetworzona forma, składnik to surowy

    # Mismatch kwalifikatora dietetycznego: "majonez wegański" ≠ "majonez"
    diet_p = meaningful_p & _DIETARY_QUALIFIERS
    diet_i = meaningful_i & _DIETARY_QUALIFIERS
    if diet_p and not diet_i:
        return tsr  # produkt ma kwalifikator, składnik nie — nie matchuj

    # Składnik zaczyna nazwę produktu vs pojawia się jako kwalifikator/smak
    first_product_token = next((t for t in tokens_p if len(t) > 1), "")
    ingredient_leads = first_product_token in meaningful_i

    if pr >= 85 and not ingredient_leads and tsr < 77:
        return tsr   # "jagoda" w "jogurt jagoda", "mak" w "jogurt mak marcepan"

    # Reguła 2→1: jeśli składnik ma 2 tokeny a produkt tylko 1,
    # i żaden inny token składnika nie pojawia się w produkcie,
    # i TSR jest niski → prawdopodobne fałszywe dopasowanie przez wspólne słowo
    # TYLKO dla bardzo niskiego TSR (< 50) żeby nie blokować normalnych przypadków
    if ingredient_leads and len(meaningful_i) >= 2 and len(meaningful_p) == 1:
        non_leading_i = meaningful_i - {first_product_token}
        if non_leading_i and not (non_leading_i & meaningful_p) and tsr < 50:
            return tsr  # np. "serca karczochów"→"serca" (tsr≈48), "amino kokosowe"→"aminokwasy"

    return max(tsr, pr)


def rank_candidates(ingredient: str, shop_products: list[dict]) -> list[tuple[float, dict]]:
    scored = [(score(ingredient, p["generic_name"]), p) for p in shop_products]
    ing_words = len(ingredient.split())
    ing_tokens = set(ingredient.lower().split())
    # Tiebreaker:
    # 1. Więcej tokenów składnika w produkcie → lepiej (liofil. truskawki → liofil. truskawki całe > truskawki)
    # 2. Mniejsza różnica liczby słów → lepiej (mielona wołowina → mielona wołowina > wołowina)
    def sort_key(x):
        s, p = x
        prod_tokens = set(p["generic_name"].lower().split())
        overlap = len(ing_tokens & prod_tokens)
        return (-s, -overlap, abs(len(p["generic_name"].split()) - ing_words))
    scored.sort(key=sort_key)
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

    for orig_ing in unique_ingredients:
        # Tłumacz znane aliasy — używaj kanonicznej nazwy do matchowania,
        # ale zachowaj oryginalną jako klucz słownika (bo przepisy używają orig nazwy)
        ing = _INGREDIENT_CANONICAL_PL.get(orig_ing, orig_ing) if lang == "PL" else _INGREDIENT_CANONICAL_EN.get(orig_ing, orig_ing)
        ranked = rank_candidates(ing, shops)
        top_score, top_product = ranked[0] if ranked else (0, None)

        if top_score >= SCORE_AUTO:
            auto_matches[orig_ing] = (top_score, top_product)  # klucz = oryginalna nazwa
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


# ── Debug report ──────────────────────────────────────────────────────────────

def _write_debug():
    from debug_writer import write_report

    matches_en = json.loads(OUT_EN.read_text("utf-8"))
    matches_pl = json.loads(OUT_PL.read_text("utf-8"))
    unmatched_en_raw_f = DATA / "unmatched_en_raw.json"
    unmatched_pl_raw_f = DATA / "unmatched_pl_raw.json"
    unmatched_en = json.loads(unmatched_en_raw_f.read_text("utf-8")) if unmatched_en_raw_f.exists() else []
    unmatched_pl = json.loads(unmatched_pl_raw_f.read_text("utf-8")) if unmatched_pl_raw_f.exists() else []

    total_en = len(matches_en) + len(unmatched_en)
    total_pl = len(matches_pl) + len(unmatched_pl)

    def match_row(m):
        score = m.get("fuzzy_score", "?")
        mtype = m.get("match_type", "?")
        price = m.get("price_per_100")
        return (f"{m['ingredient_name']:<35} → {m.get('original_name', ''):<50} "
                f"| score={str(score):<5} | {mtype:<16} | {price if price is not None else '—'}")

    sections = [
        {
            "title": "Statystyki dopasowania",
            "stats": {
                "Unikalne składniki EN":       total_en,
                "Dopasowane EN":               len(matches_en),
                "Niedopasowane EN":            len(unmatched_en),
                "% dopasowania EN":            f"{len(matches_en)/max(1,total_en)*100:.1f}%",
                "MATCH_AUTO EN":               sum(1 for m in matches_en if m.get("match_type") == "MATCH_AUTO"),
                "MATCH_UNCERTAIN EN":          sum(1 for m in matches_en if m.get("match_type") == "MATCH_UNCERTAIN"),
                "Unikalne składniki PL":       total_pl,
                "Dopasowane PL":               len(matches_pl),
                "Niedopasowane PL":            len(unmatched_pl),
                "% dopasowania PL":            f"{len(matches_pl)/max(1,total_pl)*100:.1f}%",
                "MATCH_AUTO PL":               sum(1 for m in matches_pl if m.get("match_type") == "MATCH_AUTO"),
                "MATCH_UNCERTAIN PL":          sum(1 for m in matches_pl if m.get("match_type") == "MATCH_UNCERTAIN"),
            },
            "rows": [],
        },
        {
            "title": "EN — dopasowania (ingredient_name → original_name | score | type | price_per_100)",
            "rows": [match_row(m) for m in sorted(matches_en, key=lambda x: x["ingredient_name"])],
        },
        {
            "title": "EN — niedopasowane składniki",
            "rows": sorted(unmatched_en),
        },
        {
            "title": "PL — dopasowania (ingredient_name → original_name | score | type | price_per_100)",
            "rows": [match_row(m) for m in sorted(matches_pl, key=lambda x: x["ingredient_name"])],
        },
        {
            "title": "PL — niedopasowane składniki",
            "rows": sorted(unmatched_pl),
        },
    ]
    write_report(3, "match_ingredients", sections)


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

    _write_debug()


if __name__ == "__main__":
    main()
