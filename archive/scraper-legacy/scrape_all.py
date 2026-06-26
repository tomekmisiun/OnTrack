#!/usr/bin/env python3
"""
Odpala wszystkie 3 scrapery równolegle i aktualizuje pliki danych.

Scrapery:
  aldi_scraper.py      → data/aldi_products.json
  auchan_scraper.py    → data/auchan_products.json
  biedronka_scraper.py → data/biedronka_products.json

Użycie:
    python scrape_all.py                  # wszystkie 3 równolegle
    python scrape_all.py --seq            # po kolei (mniej RAM/CPU)
    python scrape_all.py --only aldi      # tylko jeden scraper
    python scrape_all.py --limit 50       # przekaż --limit do każdego scrapera
"""

import asyncio
import argparse
import sys
import time
from pathlib import Path

HERE    = Path(__file__).parent
PYTHON  = HERE / ".venv" / "bin" / "python3"

SCRAPERS = [
    {
        "name":    "Aldi",
        "script":  HERE / "scrapers" / "aldi_scraper.py",
        "out":     HERE / "data" / "aldi_products.json",
        "has_out": False,   # Aldi ma stałą ścieżkę wyjściową
        "color":   "\033[34m",
    },
    {
        "name":    "Auchan",
        "script":  HERE / "scrapers" / "auchan_scraper.py",
        "out":     HERE / "data" / "auchan_products.json",
        "has_out": True,
        "color":   "\033[31m",
    },
    {
        "name":    "Biedronka",
        "script":  HERE / "scrapers" / "biedronka_scraper.py",
        "out":     HERE / "data" / "biedronka_products.json",
        "has_out": True,
        "color":   "\033[32m",
    },
]

RESET = "\033[0m"
BOLD  = "\033[1m"


def prefix(scraper: dict) -> str:
    return f"{scraper['color']}{BOLD}[{scraper['name']:10s}]{RESET} "


async def run_scraper(scraper: dict, extra_args: list[str]) -> tuple[str, int, float]:
    """Uruchamia jeden scraper i na bieżąco wypisuje jego output z prefiksem."""
    cmd = [str(PYTHON), str(scraper["script"])]
    if scraper.get("has_out"):
        cmd += ["--out", str(scraper["out"])]
    cmd += extra_args

    pfx   = prefix(scraper)
    start = time.time()

    print(f"{pfx}Startuje: {' '.join(cmd[2:])}")

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
        cwd=HERE,
    )

    async for raw_line in proc.stdout:
        line = raw_line.decode("utf-8", errors="replace").rstrip()
        if line:
            print(f"{pfx}{line}")

    await proc.wait()
    elapsed = round(time.time() - start, 1)
    status  = "✓" if proc.returncode == 0 else "✗"
    color   = scraper["color"] if proc.returncode == 0 else "\033[31m"
    print(f"\n{color}{BOLD}{status} {scraper['name']} zakończony — {elapsed}s{RESET}\n")
    return scraper["name"], proc.returncode, elapsed


async def run_parallel(scrapers: list[dict], extra_args: list[str]):
    print(f"{BOLD}Równoległe scrapowanie: {', '.join(s['name'] for s in scrapers)}{RESET}\n")
    results = await asyncio.gather(
        *[run_scraper(s, extra_args) for s in scrapers],
        return_exceptions=True,
    )
    return results


async def run_sequential(scrapers: list[dict], extra_args: list[str]):
    print(f"{BOLD}Kolejne scrapowanie: {', '.join(s['name'] for s in scrapers)}{RESET}\n")
    results = []
    for s in scrapers:
        result = await run_scraper(s, extra_args)
        results.append(result)
    return results


def print_summary(results, total_time: float):
    print(f"\n{'='*60}")
    print(f"{BOLD}Podsumowanie{RESET}  (łączny czas: {total_time}s)")
    print(f"{'='*60}")
    for r in results:
        if isinstance(r, Exception):
            print(f"  ✗  BŁĄD: {r}")
            continue
        name, code, elapsed = r
        icon = "✓" if code == 0 else "✗"
        print(f"  {icon}  {name:<12} {elapsed:>6}s  exit={code}")

    # Rozmiary plików
    print(f"\nPliki danych:")
    for s in SCRAPERS:
        path = s["out"]
        if path.exists():
            size_kb = path.stat().st_size // 1024
            import json
            try:
                count = len(json.loads(path.read_text("utf-8")))
                print(f"  {path.name:<30} {count:>5} produktów  ({size_kb} KB)")
            except Exception:
                print(f"  {path.name:<30} {size_kb} KB")
        else:
            print(f"  {path.name:<30} brak pliku")
    print()


def main():
    ap = argparse.ArgumentParser(description="Uruchamia wszystkie scrapery produktów")
    ap.add_argument("--seq",   action="store_true",
                    help="Uruchamiaj scrapery po kolei zamiast równolegle (mniej RAM)")
    ap.add_argument("--only",  default=None,
                    help="Tylko jeden scraper: aldi / auchan / biedronka")
    ap.add_argument("--limit", type=int, default=None,
                    help="Przekaż --limit N do każdego scrapera (do testów)")
    ap.add_argument("--headful", action="store_true",
                    help="Przekaż --headful (widoczna przeglądarka)")
    args = ap.parse_args()

    # Wybierz scrapery
    if args.only:
        scrapers = [s for s in SCRAPERS if s["name"].lower() == args.only.lower()]
        if not scrapers:
            print(f"Nieznany scraper '{args.only}'. Dostępne: aldi, auchan, biedronka")
            sys.exit(1)
    else:
        scrapers = SCRAPERS

    # Dodatkowe argumenty przekazywane do każdego scrapera
    extra: list[str] = []
    if args.limit:
        extra += ["--limit", str(args.limit)]
    if args.headful:
        extra += ["--headful"]

    # Sprawdź że .venv istnieje
    if not PYTHON.exists():
        print(f"Brak .venv pod {PYTHON}")
        print("Uruchom: cd scraper && python3 -m venv .venv && .venv/bin/pip install playwright thefuzz")
        sys.exit(1)

    # Utwórz folder data jeśli nie istnieje
    (HERE / "data").mkdir(exist_ok=True)

    total_start = time.time()

    if args.seq or len(scrapers) == 1:
        results = asyncio.run(run_sequential(scrapers, extra))
    else:
        results = asyncio.run(run_parallel(scrapers, extra))

    total_time = round(time.time() - total_start, 1)
    print_summary(results, total_time)


if __name__ == "__main__":
    main()
