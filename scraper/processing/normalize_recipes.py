#!/usr/bin/env python3
"""
Krok 1: Normalizuje przepisy z mealpreponfleek — składniki EN+PL przez DeepSeek.
Batch po 5, ThreadPoolExecutor(max_workers=3), retry 2x, sleep(10) na rate limit.

Wejście:  data/mealpreponfleek_recipes.json
Wyjście:  data/recipes_normalized.json
Partial:  data/recipes_normalized_partial.json  (co 10 batchy)
"""

import os, sys, json, re, time, logging
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    from openai import OpenAI
except ImportError:
    print("Brak openai. Zainstaluj: pip install openai")
    sys.exit(1)

HERE = Path(__file__).parent
DATA = HERE.parent / "data"

INPUT_FILE   = DATA / "mealpreponfleek_recipes.json"
OUTPUT_FILE  = DATA / "recipes_normalized.json"
PARTIAL_FILE = DATA / "recipes_normalized_partial.json"

BATCH_SIZE  = 5
MAX_WORKERS = 3
SAVE_EVERY  = 10   # batches between checkpoints
MAX_RETRIES = 2

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


# ── System Prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """\
You normalize recipe ingredients to a canonical form. Apply these rules identically
to how shop products are normalized — symmetry is critical for matching later.

Return ONLY a valid JSON array, no markdown, no explanation.

═══ SERVING SIZE NORMALIZATION (CRITICAL — do this FIRST) ═══

The input JSON includes "servings": N — the number of portions the recipe makes.
You MUST divide ALL ingredient amounts by this number to get per-person (1 serving) amounts.

If "servings" is null or missing, infer from countable whole-food items:
  - "4 large eggs" → 4 servings | "5 medium wraps" → 5 | "4 chicken breasts" → 4
  - "8 slices bacon" → 4 servings (2 per person) | "4 cups vegetable stock" → 4
  - Default to 4 if unclear

Example (servings=4): ingredient "4 cups vegetable stock" → 1 cup → 236 ml per serving.

Include "servings": N in the output (use the provided value or your inferred value).

For each recipe return:
{
  "name_en": "Generic English name, title case, no brand",
  "name_pl": "Polska nazwa, mianownik, bez marki",
  "url": "unchanged",
  "image_url": "unchanged",
  "category": "unchanged",
  "servings": number,
  "ingredients_en": [{"name": string, "amount": number|null, "unit": string|null}],
  "ingredients_pl": [{"name": string, "amount": number|null, "unit": string|null}]
}

═══ INGREDIENT NAME RULES (apply to BOTH ingredients_en and ingredients_pl) ═══

ALWAYS REMOVE from ingredient name:
- Prep notes: boneless, skinless, bone-in, skin-on, diced, minced, chopped, shredded,
  sliced, finely, roughly, thinly, peeled, deveined, halved, quartered, cubed, trimmed,
  at room temperature, softened, melted, cooked (+ anything after: "cooked according to...")
- Fat/lean %: full fat, reduced fat, low fat, non-fat, nonfat, fat-free, lowfat,
  light, X% fat, X% lean, X/Y lean (e.g. 93/7, 80/20)
- Quality/origin: wild-caught, grass-fed, grain-fed, corn-fed, organic, free range,
  boneless, skinless (already listed), british, polish, wagyu, aberdeen angus,
  iberico, sockeye (salmon species), black (cod)
- Size qualifiers on produce/eggs: large, small, medium, jumbo, baby, mini, giant
- Packaging context: canned, tinned, jarred, in juice, in brine, in water, in syrup,
  in oil, drained, ready to eat, pasteurized, micro-filtered, microfiltered, ultra-pasteurized
- Processing descriptors: toasted, roasted (when applied to oils — "toasted sesame oil" → "sesame oil"),
  cold-pressed, extra virgin (oils → just the base oil name),
  creamy (for nut butters — "creamy peanut butter" → "peanut butter"),
  grated (for parmesan), shredded (for cheese)
- Origin/variety descriptors for oils: "cold pressed", "extra virgin", "refined",
  "toasted" → drop and keep just "olive oil", "sesame oil", "avocado oil" etc.
- Filler words: fresh (when redundant), raw (when redundant), pure
- Instructions appended to ingredients: everything after comma that is an instruction
  ("cooked according to package directions", "for greasing", "for topping", "to taste")

COCONUT AMINOS — important:
  "coconut aminos" is NOT coconut milk. It is a soy sauce substitute made from coconut sap.
  → name_en: "coconut aminos", name_pl: "amino kokosowe"
  → Do NOT map to coconut milk, coconut oil, or any other coconut product

KEEP when it defines the ingredient:
- ground / mince (always normalize "mince" to "ground"):
  beef mince -> ground beef | pork mince -> ground pork
- smoked ONLY for fish: smoked salmon, smoked haddock
  smoked bacon -> bacon | smoked ham -> ham
- dried when it changes the ingredient: dried apricots, sun-dried tomatoes
- Form that changes culinary use: ground beef != beef steak, chicken breast != chicken thighs
- steaks: KEEP for beef (beef steak), REMOVE for fish (salmon steaks -> salmon)

DAIRY (fat% never matters, TYPE matters):
  plain yogurt / natural yogurt / regular yogurt -> "plain yogurt"
  greek yogurt (any fat%) -> "greek yogurt"
  dairy free yogurt / vegan yogurt / almond milk yogurt -> "dairy free yogurt"
  milk / whole milk / 2% milk / skim milk -> "milk"
  almond milk (any variety) -> "almond milk"
  coconut milk / canned coconut milk / full fat coconut milk -> "coconut milk"
  cream cheese (any fat%) -> "cream cheese"
  cottage cheese (any fat%) -> "cottage cheese"
  sour cream (any fat%) -> "sour cream"

MEAT (form defines the ingredient):
  chicken breast / boneless skinless chicken breast / chicken tenders -> "chicken breast"
  chicken thighs (any prep) -> "chicken thighs"
  ground beef (any % lean) -> "ground beef"
  salmon / salmon fillets / wild-caught salmon / atlantic salmon -> "salmon"
    EXCEPTION: smoked salmon -> "smoked salmon"
  shrimp / raw shrimp / jumbo shrimp / prawns -> "shrimp"
  cod / black cod -> "cod"

SPLIT on "&" when joining two distinct ingredients:
  "salt & pepper" -> two items: "salt", "pepper"
  "bacon & sausages" -> two items: "bacon", "sausage"
  DO NOT split: "macaroni & cheese", "fish & chips" (single dishes)

REMOVE brand names entirely (Kikkoman, Heinz, Whole30, Paleo Powder, BiPro, etc.)
REMOVE everything in parentheses that is a tip/suggestion/brand
  KEEP parentheses content if it's a valid ingredient alternative: "(or vegetable broth)"
  -> use the first option only

"to taste" / "as desired" / "as needed" / "optional":
  - If the ingredient is a SEASONING (salt, pepper, sugar, any spice, herb, or generic
    "seasoning") -> amount: 1, unit: "g"
  - For ALL other ingredients without a specified amount -> amount: null, unit: null

Seasonings that always get 1g default when no amount given:
  salt, sea salt, pepper, black pepper, white pepper, red pepper flakes,
  sugar, brown sugar, cinnamon, cumin, paprika, smoked paprika, turmeric,
  garlic powder, onion powder, cayenne, chili powder, chili flakes,
  oregano, thyme, basil, rosemary, bay leaf, dill, parsley, cilantro,
  ginger (ground), nutmeg, allspice, coriander, mustard powder,
  seasoning, spice, spices, Italian seasoning, taco seasoning,
  everything bagel seasoning, Cajun seasoning, curry powder,
  baking powder, baking soda, cream of tartar, salt & pepper

═══ AMOUNT & UNIT RULES ═══

Output units MUST be one of: g, ml, pcs — NEVER output "cups", "tbsp", "tsp", "oz", "lb".
Always convert volumetric/imperial units to g or ml before returning.

CRITICAL — juice/liquid ingredients MUST use ml, NEVER pcs:
  "lime juice / lemon juice / orange juice" → unit: ml  (NOT limes/lemons in pcs!)
  "2 tbsp lime juice" → amount: 30, unit: ml
  "juice of 1 lemon" → amount: 30, unit: ml

Conversions (use these exactly):
  1 cup  = 236ml (liquids, broths, juices, milk, oil, yogurt, sour cream)
  1 cup  = 120g  (flour) | 200g (sugar, brown sugar) | 90g (oats, rolled oats)
  1 cup  = 185g  (rice, quinoa) | 120g (nuts, seeds) | 30g (leafy greens, spinach)
  1 cup  = 160g  (shredded cheese) | 170g (ricotta, cream cheese) | 240g (Greek yogurt)
  1 cup  = 150g  (blueberries, raspberries) | 180g (strawberries) | 16g (fresh cilantro/parsley)
  1 cup  = 320g  (celery, chopped) | 200g (sweet potato, cubed) | 180g (kale)
  1 oz   = 28g   | 1 lb = 454g
  1 tbsp = 15ml  (liquids) | 15g (solid ingredients, spices, sauces, nut butters)
  1 tsp  = 5ml   (liquids) | 5g  (solid ingredients, spices, extracts)
  1 can  = 400g  (standard 14oz can: tomatoes, beans, coconut milk, chickpeas)

When ingredient is counted in pcs, convert to grams using these AVERAGE WEIGHTS:
  sweet potato / batat: 200g each
  potato / ziemniak: 150g each
  salmon fillet / filet z łososia: 150g each
  chicken breast / pierś z kurczaka: 180g each
  chicken thigh / udko z kurczaka: 130g each
  pork chop / kotlet wieprzowy: 150g each
  shrimp (large) / krewetka: 15g each
  carrot / marchew: 80g each
  celery stalk / łodyga selera: 40g each | celery (whole): 320g
  onion / cebula: 100g each
  garlic clove / ząbek czosnku: 5g each
  tomato / pomidor: 120g each
  bell pepper / papryka: 150g each
  cucumber / ogórek: 250g each
  zucchini / cukinia: 300g each
  eggplant / bakłażan: 250g each
  avocado / awokado: 200g each
  banana / banan: 120g each
  apple / jabłko: 150g each
  lemon / cytryna: 80g each
  lime / limonka: 70g each
  egg / jajko: 60g each
  jalapeño / jalapeño: 15g each
  mango: 300g each | pineapple / ananas: 900g each

amount must be a number or null, never a string.

═══ POLISH NAMES (ingredients_pl) ═══

Apply ALL the same normalization rules above, then translate to Polish.
Use mianownik (nominative case) as products appear on Polish shop shelves.
Examples:
  chicken breast -> "filet z kurczaka"
  chicken thighs -> "udka z kurczaka"
  ground beef -> "mielona woowina"
  ground pork -> "mielona wieprzowina"
  ground turkey -> "mielony indyk"
  shrimp -> "krewetki"
  salmon -> "losos"
  smoked salmon -> "wedzony losos"
  cod -> "dorsz"
  greek yogurt -> "jogurt grecki"
  plain yogurt -> "jogurt naturalny"
  dairy free yogurt -> "jogurt rosliny"
  coconut milk -> "mleko kokosowe"
  almond milk -> "mleko migdalowe"
  soy sauce -> "sos sojowy"
  sesame oil -> "olej sezamowy"
  olive oil -> "oliwa z oliwek"
  garlic -> "czosnek"
  red onion -> "cebula czerwona"
  onion -> "cebula"
  sweet potato -> "batat"
  bell pepper -> "papryka"
  feta cheese -> "ser feta"
  mozzarella -> "mozzarella"
  cheddar -> "cheddar"
  parmesan -> "parmezan"
  cream cheese -> "twarog kremowy"
  sour cream -> "smietana"
  cottage cheese -> "twarog"
  butter -> "maslo"
  eggs -> "jajka"
  flour -> "maka"
  baking powder -> "proszek do pieczenia"
  baking soda -> "soda oczyszczona"
  cornstarch -> "skrobia kukurydziana"
  vanilla extract -> "ekstrakt waniliowy"
  cocoa powder -> "kakao"
  honey -> "miod"
  maple syrup -> "syrop klonowy"
  fish sauce -> "sos rybny"
  hot sauce -> "sos ostry"
  sriracha -> "sriracha"
  chicken broth -> "bulion drobiowy"
  beef broth -> "bulion wolowy"
  vegetable broth -> "bulion warzywny"
"""


# ── API helpers ───────────────────────────────────────────────────────────────

def get_client() -> "OpenAI":
    key = os.environ.get("DEEPSEEK_API_KEY")
    if not key:
        raise RuntimeError("DEEPSEEK_API_KEY nie ustawiony w środowisku")
    return OpenAI(api_key=key, base_url="https://api.deepseek.com")


_PL_LETTERS  = re.compile(r"[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]")
_EN_KEYWORDS = re.compile(
    r"\b(easy|simple|the |and |with |for |from |gluten.free|dairy.free|"
    r"meal prep|whole30|paleo|keto|aip|diy|low.carb|high.protein|sugar.free)\b", re.I
)

# Listicle / roundup — nie są przepisami
_ROUNDUP = re.compile(
    r"^\d{1,3}\s+(ideas?|ways?|recipes?\b|best|easy|healthy|egg.free|"
    r"high.protein|low.carb|meal prep ideas)", re.I
)


def _is_untranslated(name_en: str, name_pl: str) -> bool:
    """Sprawdza czy name_pl to w rzeczywistości nieprzetłumaczone name_en."""
    if not name_pl:
        return True
    if name_pl.lower().strip() == name_en.lower().strip():
        return True
    if not _PL_LETTERS.search(name_pl) and _EN_KEYWORDS.search(name_pl):
        return True
    return False


def _fix_translation(client, recipe: dict) -> dict:
    """Ponawia tłumaczenie tylko dla name_pl (szybkie, bez pełnej normalizacji)."""
    prompt = (
        f"Translate this English recipe title to Polish. "
        f"Use natural Polish, drop marketing words like 'Easy', 'Simple', 'Meal Prep'. "
        f"Return ONLY the Polish title, nothing else.\n\n{recipe.get('name_en', '')}"
    )
    try:
        resp = client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=60,
        )
        pl = resp.choices[0].message.content.strip().strip('"\'')
        if pl:
            recipe["name_pl"] = pl
            log.info(f"  Przetłumaczono: {recipe['name_en'][:40]} → {pl}")
    except Exception as e:
        log.warning(f"  Fix translation nieudany: {e}")
    return recipe


def _validate_and_fix(client, results: list, originals: list) -> list:
    """Sprawdza wyniki i naprawia brakujące tłumaczenia name_pl."""
    fixed = []
    for i, r in enumerate(results):
        if r is None:
            fixed.append(r)
            continue
        name_en = r.get("name_en", "")
        name_pl = r.get("name_pl", "")
        if _is_untranslated(name_en, name_pl):
            r = _fix_translation(client, r)
        fixed.append(r)
    return fixed


def _parse_response(content: str) -> list:
    content = content.strip()
    content = re.sub(r"^```(?:json)?\s*", "", content)
    content = re.sub(r"\s*```$", "", content)
    parsed = json.loads(content)
    if isinstance(parsed, list):
        return parsed
    for v in parsed.values():
        if isinstance(v, list):
            return v
    raise ValueError(f"Odpowiedź nie jest listą: {content[:200]}")


def _call_api(client, recipes_batch: list) -> list:
    resp = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": json.dumps(recipes_batch, ensure_ascii=False)},
        ],
        temperature=0.0,
    )
    return _parse_response(resp.choices[0].message.content)


def normalize_batch(client, recipes: list) -> list:
    """Batch z retry. Przy niepowodzeniu — per-recipe fallback. Waliduje tłumaczenia."""
    last_err = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            results = _call_api(client, recipes)
            return _validate_and_fix(client, results, recipes)
        except Exception as e:
            last_err = e
            if "429" in str(e) or "rate" in str(e).lower():
                log.warning("Rate limit — czekam 10s")
                time.sleep(10)
            elif attempt < MAX_RETRIES:
                log.warning(f"Batch próba {attempt + 1} nieudana: {e}")
                time.sleep(2)

    log.warning(f"Batch nieudany ({last_err}), fallback per-recipe")
    results = []
    for recipe in recipes:
        try:
            r = _call_api(client, [recipe])[0]
            r = _validate_and_fix(client, [r], [recipe])[0]
            results.append(r)
        except Exception as e:
            log.error(f"Przepis '{recipe.get('name', '?')}' nieudany: {e}")
            results.append(None)
    return results


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    if OUTPUT_FILE.exists():
        log.info(f"Plik wyjściowy już istnieje: {OUTPUT_FILE}. Pomijam krok 1.")
        return

    all_recipes = json.loads(INPUT_FILE.read_text("utf-8"))
    # Odfiltruj listicle / roundup articles ("17 Breakfast Ideas", "10 Easy Ways...")
    recipes = [r for r in all_recipes if not _ROUNDUP.search(r.get("name", "") or "")]
    if len(recipes) < len(all_recipes):
        log.info(f"Odfiltrowano {len(all_recipes) - len(recipes)} roundup articles")
    log.info(f"Wczytano {len(recipes)} przepisów")

    # Wczytaj checkpoint
    done: dict[int, dict] = {}
    if PARTIAL_FILE.exists():
        try:
            partial = json.loads(PARTIAL_FILE.read_text("utf-8"))
            done = {p["_idx"]: p for p in partial if p and "_idx" in p}
            log.info(f"Checkpoint: {len(done)} przepisów już gotowych")
        except Exception:
            pass

    # Podziel na batche
    batches: list[list[tuple[int, dict]]] = []
    for i in range(0, len(recipes), BATCH_SIZE):
        chunk = list(enumerate(recipes[i:i + BATCH_SIZE], start=i))
        if not all(idx in done for idx, _ in chunk):
            batches.append(chunk)

    log.info(f"Batche do przetworzenia: {len(batches)}")
    if not batches:
        log.info("Wszystko gotowe.")

    completed = 0

    def process_batch(indexed: list[tuple[int, dict]]) -> list[tuple[int, dict]]:
        c = get_client()
        plain = [r for _, r in indexed]
        results = normalize_batch(c, plain)
        return [(indexed[j][0], results[j]) for j in range(len(results))]

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as exe:
        futures = {exe.submit(process_batch, b): b for b in batches}
        for future in as_completed(futures):
            try:
                for idx, result in future.result():
                    if result is not None:
                        result["_idx"] = idx
                        done[idx] = result
            except Exception as e:
                log.error(f"Batch nieudany: {e}")
            completed += 1
            if completed % SAVE_EVERY == 0:
                checkpoint = [done[k] for k in sorted(done)]
                PARTIAL_FILE.write_text(
                    json.dumps(checkpoint, ensure_ascii=False, indent=2), "utf-8"
                )
                log.info(f"Checkpoint zapisany: {len(done)}/{len(recipes)}")

    final = []
    for k in sorted(done):
        r = {key: val for key, val in done[k].items() if key != "_idx"}
        final.append(r)

    OUTPUT_FILE.write_text(json.dumps(final, ensure_ascii=False, indent=2), "utf-8")
    log.info(f"Zapisano {len(final)} przepisów → {OUTPUT_FILE}")

    if PARTIAL_FILE.exists():
        PARTIAL_FILE.unlink()

    skipped = len(recipes) - len(final)
    if skipped:
        log.warning(f"{skipped} przepisów nie udało się znormalizować (None)")


if __name__ == "__main__":
    main()
