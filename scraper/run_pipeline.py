#!/usr/bin/env python3
"""
Orchestrator całego pipeline'u przepisów + produktów.

Kroki:
  1  normalize_recipes   — normalizacja przepisów EN+PL przez DeepSeek
  2  normalize_shops     — normalizacja produktów sklepowych (czysty Python)
  3  match_ingredients   — rapidfuzz + DeepSeek dla niejednoznacznych
  4  build_database      — ingredient_db, unmatched, recipes z kosztem
  5  get_macros          — makroskładniki przez DeepSeek

Użycie:
    python run_pipeline.py               # wszystkie kroki
    python run_pipeline.py --from 3      # od kroku 3
    python run_pipeline.py --only 2      # tylko krok 2
"""

import argparse
import logging
import os
import subprocess
import sys
import time
from pathlib import Path

# Wczytaj .env z katalogu projektu (mealprep/.env)
_env_file = Path(__file__).parent.parent / ".env"
if _env_file.exists():
    for _line in _env_file.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _, _v = _line.partition("=")
            os.environ.setdefault(_k.strip(), _v.strip())

HERE   = Path(__file__).parent
PYTHON = HERE / ".venv" / "bin" / "python3"
PROC   = HERE / "processing"
LOG_FILE = HERE / "pipeline.log"

STEPS = [
    (1, "normalize_recipes",   PROC / "normalize_recipes.py"),
    (2, "normalize_shops",     PROC / "normalize_shops.py"),
    (3, "match_ingredients",   PROC / "match_ingredients.py"),
    (4, "build_database",      PROC / "build_database.py"),
    (5, "get_macros",          PROC / "get_macros.py"),
]

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)


# ── Runner ────────────────────────────────────────────────────────────────────

def run_step(num: int, name: str, script: Path) -> bool:
    log.info(f"{'='*60}")
    log.info(f"KROK {num}: {name}")
    log.info(f"{'='*60}")

    if not script.exists():
        log.error(f"Skrypt nie istnieje: {script}")
        return False

    start = time.time()
    result = subprocess.run(
        [str(PYTHON), str(script)],
        cwd=HERE,
    )
    elapsed = round(time.time() - start, 1)

    if result.returncode == 0:
        log.info(f"✓ Krok {num} zakończony — {elapsed}s")
        return True
    else:
        log.error(f"✗ Krok {num} nieudany (exit={result.returncode}) — {elapsed}s")
        return False


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="Pipeline przepisów + produktów")
    ap.add_argument("--from", dest="from_step", type=int, default=1,
                    help="Zacznij od kroku N (domyślnie: 1)")
    ap.add_argument("--only", dest="only_step", type=int, default=None,
                    help="Uruchom tylko krok N")
    args = ap.parse_args()

    if not PYTHON.exists():
        log.error(f"Brak .venv pod {PYTHON}")
        log.error("Uruchom: cd scraper && python3 -m venv .venv && .venv/bin/pip install openai rapidfuzz")
        sys.exit(1)

    steps_to_run = []
    for num, name, script in STEPS:
        if args.only_step is not None:
            if num == args.only_step:
                steps_to_run.append((num, name, script))
        elif num >= args.from_step:
            steps_to_run.append((num, name, script))

    if not steps_to_run:
        log.error("Brak kroków do uruchomienia.")
        sys.exit(1)

    log.info(f"Uruchamiam kroki: {[n for n, _, _ in steps_to_run]}")
    pipeline_start = time.time()

    for num, name, script in steps_to_run:
        ok = run_step(num, name, script)
        if not ok:
            log.error(f"Pipeline przerwany na kroku {num}.")
            sys.exit(1)

    total = round(time.time() - pipeline_start, 1)
    log.info(f"\n{'='*60}")
    log.info(f"Pipeline zakończony pomyślnie — łączny czas: {total}s")
    log.info(f"{'='*60}")

    # Podsumowanie plików wynikowych
    DATA = HERE / "data"
    result_files = [
        "recipes_normalized.json",
        "shops_en.json", "shops_pl.json",
        "matches_en.json", "matches_pl.json",
        "ingredient_db_en.json", "ingredient_db_pl.json",
        "unmatched_en.json", "unmatched_pl.json",
        "recipes_en.json", "recipes_pl.json",
        "ingredients_macros.json",
    ]
    log.info("\nPliki wynikowe:")
    import json
    for fname in result_files:
        p = DATA / fname
        if p.exists():
            try:
                count = len(json.loads(p.read_text("utf-8")))
                log.info(f"  ✓  {fname:<35} {count:>5} rekordów")
            except Exception:
                log.info(f"  ✓  {fname}")
        else:
            log.info(f"  -  {fname:<35} brak")


if __name__ == "__main__":
    main()
