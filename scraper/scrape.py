"""
Pipeline scraperów — odpala po kolei wszystkie scrapery i katalog.

Kroki:
  1. auchan_scraper.py      → auchan_products.json
  2. biedronka_scraper.py   → biedronka_products.json
  3. aniagotuje_scraper.py  → aniagotuje_recipes.json
  4. pipeline.py            → build catalogue + import + fill_macros

Użycie:
    python scrape.py               # wszystkie kroki
    python scrape.py --steps 1 2   # tylko Auchan + Biedronka
    python scrape.py --steps 4     # tylko pipeline produktów (bez scraperów)
    python scrape.py --no-recipes  # sklepy + pipeline, bez przepisów
"""

import argparse
import subprocess
import sys
import time
from pathlib import Path

STEPS = [
    (1, "Auchan scraper",     ["python3", "auchan_scraper.py"]),
    (2, "Biedronka scraper",  ["python3", "biedronka_scraper.py"]),
    (3, "AniaCooks recipes",  ["python3", "aniagotuje_scraper.py"]),
    (4, "Product pipeline",   ["python3", "pipeline.py"]),
]


def run_step(num: int, label: str, cmd: list[str]) -> bool:
    print(f"\n{'='*60}")
    print(f"  Krok {num}: {label}")
    print(f"  Komenda: {' '.join(cmd)}")
    print(f"{'='*60}\n")

    start = time.time()
    result = subprocess.run(cmd, cwd=Path(__file__).parent)
    elapsed = round(time.time() - start, 1)

    if result.returncode != 0:
        print(f"\n✗ Krok {num} NIEUDANY (exit {result.returncode}) po {elapsed}s")
        return False

    print(f"\n✓ Krok {num} zakończony ({elapsed}s)")
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--steps", nargs="+", type=int,
        default=[s[0] for s in STEPS],
        help="Które kroki uruchomić (1=Auchan 2=Biedronka 3=AniaCooks 4=Pipeline)"
    )
    parser.add_argument(
        "--no-recipes", action="store_true",
        help="Pomiń krok 3 (aniagotuje scraper)"
    )
    args = parser.parse_args()

    steps = args.steps
    if args.no_recipes:
        steps = [s for s in steps if s != 3]

    to_run = [s for s in STEPS if s[0] in steps]
    if not to_run:
        print("Brak kroków do uruchomienia.")
        sys.exit(1)

    print(f"Scrape pipeline: {len(to_run)} krok(ów)")
    for num, label, _ in to_run:
        print(f"  {num}. {label}")

    total_start = time.time()
    for num, label, cmd in to_run:
        if not run_step(num, label, cmd):
            print(f"\nPipeline przerwany na kroku {num}.")
            sys.exit(1)

    total = round(time.time() - total_start, 1)
    print(f"\n{'='*60}")
    print(f"  Wszystko gotowe ({total}s)")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
