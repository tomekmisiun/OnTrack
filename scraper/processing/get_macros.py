#!/usr/bin/env python3
"""
Step 5: Fetch macronutrients for ingredients from the database (DeepSeek, batches of 30).

Input:  data/ingredient_db_en.json
Output: data/ingredients_macros.json
"""

import os, sys, json, re, time, logging
from pathlib import Path

try:
    from openai import OpenAI
except ImportError:
    print("openai not installed. Run: pip install openai"); sys.exit(1)

HERE = Path(__file__).parent
DATA = HERE.parent / "data"

INPUT_FILE_EN = DATA / "ingredient_db_en.json"
INPUT_FILE_PL = DATA / "ingredient_db_pl.json"
OUTPUT_FILE   = DATA / "ingredients_macros.json"
PARTIAL       = DATA / "ingredients_macros_partial.json"

BATCH_SIZE  = 30
MAX_RETRIES = 2

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
Return macronutrients per 100g or 100ml of the raw/basic form of each ingredient.
Return ONLY valid JSON array, no markdown:
[{
  "name_en": string,
  "name_pl": string,
  "kcal": number,
  "protein_g": number,
  "fat_g": number,
  "carbs_g": number,
  "fiber_g": number
}]
Use USDA values. Round to 1 decimal. name_pl in mianownik (nominative case).
"""


def get_client():
    key = os.environ.get("DEEPSEEK_API_KEY")
    if not key:
        raise RuntimeError("DEEPSEEK_API_KEY is not set")
    return OpenAI(api_key=key, base_url="https://api.deepseek.com")


def fetch_macros(client, names: list[str]) -> list[dict]:
    last_err = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            resp = client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user",   "content": json.dumps(names, ensure_ascii=False)},
                ],
                temperature=0.0,
            )
            content = resp.choices[0].message.content.strip()
            content = re.sub(r"^```(?:json)?\s*", "", content)
            content = re.sub(r"\s*```$", "", content)
            parsed = json.loads(content)
            if isinstance(parsed, list):
                return parsed
            for v in parsed.values():
                if isinstance(v, list):
                    return v
            raise ValueError("Response is not a list")
        except Exception as e:
            last_err = e
            if "429" in str(e) or "rate" in str(e).lower():
                log.warning("Rate limit — waiting 10s")
                time.sleep(10)
            elif attempt < MAX_RETRIES:
                log.warning(f"Attempt {attempt + 1} failed: {e}")
                time.sleep(2)
    log.error(f"Batch failed: {last_err}")
    return []


SYSTEM_PROMPT_PL = """\
Podaj makroskładniki na 100g lub 100ml surowej/podstawowej formy każdego składnika.
Zwróć TYLKO poprawną tablicę JSON, bez markdownu:
[{
  "name_en": string,
  "name_pl": string,
  "kcal": number,
  "protein_g": number,
  "fat_g": number,
  "carbs_g": number,
  "fiber_g": number
}]
Użyj wartości USDA. Zaokrąglij do 1 miejsca po przecinku. name_pl w mianowniku.
"""


def fetch_macros_pl(client, names_pl: list[str]) -> list[dict]:
    """Like fetch_macros but for Polish ingredient names."""
    last_err = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            resp = client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT_PL},
                    {"role": "user",   "content": json.dumps(names_pl, ensure_ascii=False)},
                ],
                temperature=0.0,
            )
            content = resp.choices[0].message.content.strip()
            content = re.sub(r"^```(?:json)?\s*", "", content)
            content = re.sub(r"\s*```$", "", content)
            parsed = json.loads(content)
            if isinstance(parsed, list):
                return parsed
            for v in parsed.values():
                if isinstance(v, list):
                    return v
            raise ValueError("Response is not a list")
        except Exception as e:
            last_err = e
            if "429" in str(e) or "rate" in str(e).lower():
                log.warning("Rate limit — waiting 10s")
                time.sleep(10)
            elif attempt < MAX_RETRIES:
                time.sleep(2)
    log.error(f"Batch PL failed: {last_err}")
    return []


def _write_debug(names_en, final, missing):
    from debug_writer import write_report

    def macro_row(m):
        return (
            f"{m.get('name_en', ''):<30} | PL: {m.get('name_pl', ''):<30} | "
            f"kcal={str(m.get('kcal', '?')):<6} prot={str(m.get('protein_g', '?')):<5} "
            f"fat={str(m.get('fat_g', '?')):<5} carb={m.get('carbs_g', '?')}"
        )

    sections = [
        {
            "title": "Macronutrient stats",
            "stats": {
                "EN ingredients (input)":   len(names_en),
                "Macros fetched total":     len(final),
                "Missing macros EN":        len(missing),
            },
            "rows": [],
        },
        {
            "title": "Macronutrients (name_en | name_pl | kcal | protein | fat | carbs)",
            "rows": [macro_row(m) for m in sorted(final, key=lambda x: (x.get("name_en") or "").lower())],
        },
    ]
    if missing:
        sections.append({
            "title": "Missing macros for EN ingredients",
            "rows": sorted(missing),
        })
    write_report(5, "get_macros", sections)


def main():
    if OUTPUT_FILE.exists():
        log.info(f"Output file {OUTPUT_FILE.name} already exists. Skipping step 5.")
        return

    # Step 5a: EN ingredients
    db_en = json.loads(INPUT_FILE_EN.read_text("utf-8"))
    names_en = sorted({item["ingredient_name"] for item in db_en})
    log.info(f"EN ingredients to fetch macros for: {len(names_en)}")

    # Load checkpoint
    done: dict[str, dict] = {}
    if PARTIAL.exists():
        try:
            partial = json.loads(PARTIAL.read_text("utf-8"))
            done = {item["name_en"]: item for item in partial if item.get("name_en")}
            log.info(f"Checkpoint: {len(done)} done")
        except Exception:
            pass

    client = get_client()
    todo_en = [n for n in names_en if n not in done]

    for i in range(0, len(todo_en), BATCH_SIZE):
        batch = todo_en[i:i + BATCH_SIZE]
        results = fetch_macros(client, batch)
        for item in results:
            if item.get("name_en"):
                done[item["name_en"]] = item
        log.info(f"Batch EN {i//BATCH_SIZE + 1}/{max(1,(len(todo_en)-1)//BATCH_SIZE + 1)}: "
                 f"{len(results)} results, total {len(done)}/{len(names_en)}")
        PARTIAL.write_text(json.dumps(list(done.values()), ensure_ascii=False, indent=2), "utf-8")
        time.sleep(0.3)

    # Step 5b: PL ingredients without macros
    done_pl_names = {(item.get("name_pl") or "").lower() for item in done.values()}
    db_pl = json.loads(INPUT_FILE_PL.read_text("utf-8")) if INPUT_FILE_PL.exists() else []
    # Unique generic_name from PL database (shop product names)
    pl_products = sorted({item.get("generic_name") or item["ingredient_name"] for item in db_pl})
    missing_pl = [p for p in pl_products if p.lower() not in done_pl_names]
    log.info(f"PL products without macros: {len(missing_pl)}")

    for i in range(0, len(missing_pl), BATCH_SIZE):
        batch = missing_pl[i:i + BATCH_SIZE]
        results = fetch_macros_pl(client, batch)
        for item in results:
            if item.get("name_pl"):
                # Key by name_pl to avoid collision with EN keys
                key = f"__pl__{item['name_pl']}"
                done[key] = item
        log.info(f"Batch PL {i//BATCH_SIZE + 1}/{max(1,(len(missing_pl)-1)//BATCH_SIZE + 1)}: "
                 f"{len(results)} results")
        PARTIAL.write_text(json.dumps(list(done.values()), ensure_ascii=False, indent=2), "utf-8")
        time.sleep(0.3)

    final = list(done.values())
    OUTPUT_FILE.write_text(json.dumps(final, ensure_ascii=False, indent=2), "utf-8")
    log.info(f"Saved {len(final)} macros → {OUTPUT_FILE}")

    if PARTIAL.exists():
        PARTIAL.unlink()

    missing = set(names_en) - set(done)
    if missing:
        log.warning(f"Missing macros for {len(missing)} EN ingredients: {sorted(missing)[:10]}...")

    _write_debug(names_en, final, missing)


if __name__ == "__main__":
    main()
