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

For each recipe return:
{
  "name_en": "Generic English name, title case, no brand",
  "name_pl": "Polska nazwa, mianownik, bez marki",
  "url": "unchanged",
  "image_url": "unchanged",
  "category": "unchanged",
  "ingredients_en": [{"name": string, "amount": number|null, "unit": string|null}],
  "ingredients_pl": [{"name": string, "amount": number|null, "unit": string|null}]
}

═══ INGREDIENT NAME RULES (apply to BOTH ingredients_en and ingredients_pl) ═══

ALWAYS REMOVE from ingredient name:
- Prep notes: boneless, skinless, bone-in, skin-on, diced, minced, chopped, shredded,
  sliced, finely, roughly, thinly, peeled, deveined, halved, quartered, cubed, trimmed,
  at room temperature, softened, melted
- Fat/lean %: full fat, reduced fat, low fat, non-fat, nonfat, fat-free, lowfat,
  light, X% fat, X% lean, X/Y lean (e.g. 93/7, 80/20)
- Quality/origin: wild-caught, grass-fed, grain-fed, corn-fed, organic, free range,
  boneless, skinless (already listed), british, polish, wagyu, aberdeen angus,
  iberico, sockeye (salmon species), black (cod)
- Size qualifiers on produce/eggs: large, small, medium, jumbo, baby, mini, giant
- Packaging context: canned, tinned, jarred, in juice, in brine, in water, in syrup,
  in oil, drained, ready to eat
- Filler words: fresh (when redundant), raw (when redundant), pure

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

Output units MUST be one of: g, ml, pcs — never "cups", "tbsp", "tsp", "oz", "lb", "can".
Always convert to g / ml / pcs.

Conversions:
  1 cup liquid = 240ml | 1 cup flour = 120g | 1 cup sugar = 200g | 1 cup oats = 90g
  1 cup rice = 185g | 1 cup nuts = 120g | 1 cup leafy greens = 30g | 1 cup cilantro = 16g
  1 oz = 28g | 1 lb = 454g
  1 tbsp liquid = 15ml | 1 tbsp solid = 12g | 1 tbsp spice/herb = 8g
  1 tsp liquid = 5ml  | 1 tsp solid = 4g   | 1 tsp spice/herb = 3g
  1 can (standard) = 400g

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
    """Batch z retry. Przy niepowodzeniu — per-recipe fallback."""
    last_err = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            return _call_api(client, recipes)
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
            results.append(_call_api(client, [recipe])[0])
        except Exception as e:
            log.error(f"Przepis '{recipe.get('name', '?')}' nieudany: {e}")
            results.append(None)
    return results


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    if OUTPUT_FILE.exists():
        log.info(f"Plik wyjściowy już istnieje: {OUTPUT_FILE}. Pomijam krok 1.")
        return

    recipes = json.loads(INPUT_FILE.read_text("utf-8"))
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
