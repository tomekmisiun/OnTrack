#!/usr/bin/env python3
"""
Krok 5: Pobiera makroskładniki dla składników z bazy (DeepSeek, batch po 30).

Wejście:  data/ingredient_db_en.json
Wyjście:  data/ingredients_macros.json
"""

import os, sys, json, re, time, logging
from pathlib import Path

try:
    from openai import OpenAI
except ImportError:
    print("Brak openai. Zainstaluj: pip install openai"); sys.exit(1)

HERE = Path(__file__).parent
DATA = HERE.parent / "data"

INPUT_FILE  = DATA / "ingredient_db_en.json"
OUTPUT_FILE = DATA / "ingredients_macros.json"
PARTIAL     = DATA / "ingredients_macros_partial.json"

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
        raise RuntimeError("DEEPSEEK_API_KEY nie ustawiony")
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
            raise ValueError("Odpowiedź nie jest listą")
        except Exception as e:
            last_err = e
            if "429" in str(e) or "rate" in str(e).lower():
                log.warning("Rate limit — czekam 10s")
                time.sleep(10)
            elif attempt < MAX_RETRIES:
                log.warning(f"Próba {attempt + 1} nieudana: {e}")
                time.sleep(2)
    log.error(f"Batch nieudany: {last_err}")
    return []


def main():
    if OUTPUT_FILE.exists():
        log.info(f"Plik {OUTPUT_FILE.name} już istnieje. Pomijam krok 5.")
        return

    db = json.loads(INPUT_FILE.read_text("utf-8"))
    names = sorted({item["ingredient_name"] for item in db})
    log.info(f"Składniki do zapytania o makro: {len(names)}")

    # Wczytaj checkpoint
    done: dict[str, dict] = {}
    if PARTIAL.exists():
        try:
            partial = json.loads(PARTIAL.read_text("utf-8"))
            done = {item["name_en"]: item for item in partial}
            log.info(f"Checkpoint: {len(done)} gotowych")
        except Exception:
            pass

    client = get_client()
    todo   = [n for n in names if n not in done]

    for i in range(0, len(todo), BATCH_SIZE):
        batch = todo[i:i + BATCH_SIZE]
        results = fetch_macros(client, batch)
        for item in results:
            if item.get("name_en"):
                done[item["name_en"]] = item
        log.info(f"Batch {i//BATCH_SIZE + 1}/{(len(todo)-1)//BATCH_SIZE + 1}: "
                 f"{len(results)} wyników, łącznie {len(done)}/{len(names)}")
        PARTIAL.write_text(json.dumps(list(done.values()), ensure_ascii=False, indent=2), "utf-8")
        time.sleep(0.3)

    final = list(done.values())
    OUTPUT_FILE.write_text(json.dumps(final, ensure_ascii=False, indent=2), "utf-8")
    log.info(f"Zapisano {len(final)} makro → {OUTPUT_FILE}")

    if PARTIAL.exists():
        PARTIAL.unlink()

    missing = set(names) - set(done)
    if missing:
        log.warning(f"Brak makro dla {len(missing)} składników: {sorted(missing)[:10]}...")


if __name__ == "__main__":
    main()
