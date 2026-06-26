#!/usr/bin/env python3
"""
Orchestrator for the full recipe + product pipeline.

Steps:
  1  normalize_recipes   — normalize EN+PL recipes via DeepSeek
  2  normalize_shops     — clean and normalize shop product data (pure Python)
  3  match_ingredients   — rapidfuzz + DeepSeek for ambiguous matches
  4  build_database      — build ingredient_db, unmatched lists, recipes with cost
  5  get_macros          — fetch macronutrients via DeepSeek
  6  dump_seeds          — generate seed JSON in scraper/output/seeds/

Usage:
    python run_pipeline.py               # all steps
    python run_pipeline.py --from 3      # from step 3 onwards
    python run_pipeline.py --only 2      # only step 2
"""

import argparse
import logging
import os
import subprocess
import sys
import time
from pathlib import Path

# Load .env from project root (mealprep/.env)
_env_file = Path(__file__).parent.parent / ".env"
if _env_file.exists():
    for _line in _env_file.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _, _v = _line.partition("=")
            os.environ.setdefault(_k.strip(), _v.strip())

HERE   = Path(__file__).parent
PYTHON = HERE / ".venv" / "bin" / "python3"
PROC   = HERE / "pipeline"
LOG_FILE = HERE / "pipeline.log"

STEPS = [
    (1, "normalize_recipes",   PROC / "normalize_recipes.py"),
    (2, "normalize_shops",     PROC / "normalize_shops.py"),
    (3, "match_ingredients",   PROC / "match_ingredients.py"),
    (4, "build_database",      PROC / "build_database.py"),
    (5, "get_macros",          PROC / "get_macros.py"),
    (6, "dump_seeds",          PROC / "dump_seeds.py"),
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
    log.info(f"STEP {num}: {name}")
    log.info(f"{'='*60}")

    if not script.exists():
        log.error(f"Script not found: {script}")
        return False

    start = time.time()
    result = subprocess.run(
        [str(PYTHON), str(script)],
        cwd=HERE,
    )
    elapsed = round(time.time() - start, 1)

    if result.returncode == 0:
        log.info(f"✓ Step {num} completed — {elapsed}s")
        return True
    else:
        log.error(f"✗ Step {num} failed (exit={result.returncode}) — {elapsed}s")
        return False


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="Recipe + product pipeline")
    ap.add_argument("--from", dest="from_step", type=int, default=1,
                    help="Start from step N (default: 1)")
    ap.add_argument("--only", dest="only_step", type=int, default=None,
                    help="Run only step N")
    args = ap.parse_args()

    if not PYTHON.exists():
        log.error(f"Missing .venv at {PYTHON}")
        log.error("Run: cd scraper && python3 -m venv .venv && .venv/bin/pip install openai rapidfuzz")
        sys.exit(1)

    steps_to_run = []
    for num, name, script in STEPS:
        if args.only_step is not None:
            if num == args.only_step:
                steps_to_run.append((num, name, script))
        elif num >= args.from_step:
            steps_to_run.append((num, name, script))

    if not steps_to_run:
        log.error("No steps selected.")
        sys.exit(1)

    log.info(f"Running steps: {[n for n, _, _ in steps_to_run]}")
    pipeline_start = time.time()

    for num, name, script in steps_to_run:
        ok = run_step(num, name, script)
        if not ok:
            log.error(f"Pipeline aborted at step {num}.")
            sys.exit(1)

    total = round(time.time() - pipeline_start, 1)
    log.info(f"\n{'='*60}")
    log.info(f"Pipeline completed — total time: {total}s")
    log.info(f"{'='*60}")

    sys.path.insert(0, str(HERE))
    import json
    from data_paths import (  # noqa: E402
        INGREDIENT_DB_EN,
        INGREDIENT_DB_PL,
        INGREDIENTS_MACROS,
        MATCHES_EN,
        MATCHES_PL,
        RECIPES_EN,
        RECIPES_NORMALIZED,
        RECIPES_PL,
        SHOPS_EN,
        SHOPS_PL,
        USER_SEEDS_DIR,
    )
    result_files = [
        RECIPES_NORMALIZED,
        SHOPS_EN, SHOPS_PL,
        MATCHES_EN, MATCHES_PL,
        INGREDIENT_DB_EN, INGREDIENT_DB_PL,
        RECIPES_EN, RECIPES_PL,
        INGREDIENTS_MACROS,
    ]
    seed_files = [
        USER_SEEDS_DIR / "products_seed_en.json",
        USER_SEEDS_DIR / "recipes_seed_en.json",
    ]
    log.info("\nOutput files:")
    for p in result_files:
        if p.exists():
            try:
                count = len(json.loads(p.read_text("utf-8")))
                log.info(f"  ✓  {str(p.relative_to(HERE.parent)):<45} {count:>5} records")
            except Exception:
                log.info(f"  ✓  {p.relative_to(HERE.parent)}")
        else:
            log.info(f"  -  {str(p.relative_to(HERE.parent)):<45} missing")
    log.info("\nSeed files (scraper/output/seeds/):")
    for p in seed_files:
        if p.exists():
            try:
                count = len(json.loads(p.read_text("utf-8")))
                log.info(f"  ✓  {p.name:<35} {count:>5} records")
            except Exception:
                log.info(f"  ✓  {p.name}")
        else:
            log.info(f"  -  {p.name:<35} missing")


if __name__ == "__main__":
    main()
