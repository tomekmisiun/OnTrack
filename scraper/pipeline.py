"""
Pipeline: auchan/biedronka JSON → catalogue → baza → makra

Kroki:
  1. build_catalogue.py   — grupuje produkty z JSONów → catalogue.json
  2. import_catalogue.py  — wgrywa catalogue.json do bazy
  3. fill_macros.py       — uzupełnia makra z OpenFoodFacts
  4. dump_seed.py         — eksportuje bazę → app/data/products_seed_pl.json

Użycie:
    python pipeline.py               # wszystkie kroki
    python pipeline.py --steps 1 2   # tylko build + import (bez fill_macros i seed)
    python pipeline.py --steps 3 4   # tylko fill_macros + seed
"""

import argparse
import subprocess
import sys
import time
from pathlib import Path

STEPS = [
    (1, "Build catalogue",  ["python3", "build_catalogue.py"]),
    (2, "Import to DB",     ["python3", "import_catalogue.py", "--apply"]),
    (3, "Fill macros",      ["python3", "fill_macros.py"]),
    (4, "Dump seed",        ["python3", "dump_seed.py"]),
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
        help="Które kroki uruchomić (domyślnie: wszystkie)"
    )
    args = parser.parse_args()

    to_run = [s for s in STEPS if s[0] in args.steps]
    if not to_run:
        print("Brak kroków do uruchomienia.")
        sys.exit(1)

    print(f"Pipeline: {len(to_run)} krok(ów) → {', '.join(s[1] for s in to_run)}")

    total_start = time.time()
    for num, label, cmd in to_run:
        if not run_step(num, label, cmd):
            print(f"\nPipeline przerwany na kroku {num}.")
            sys.exit(1)

    total = round(time.time() - total_start, 1)
    print(f"\n{'='*60}")
    print(f"  Pipeline zakończony pomyślnie ({total}s)")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
