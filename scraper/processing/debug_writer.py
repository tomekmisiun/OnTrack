"""
Wspólny moduł do generowania raportów debugowania dla każdego kroku pipeline'u.
Każdy krok woła write_report(step, name, sections) na końcu main().
Wynik ląduje w scraper/debugging/stepN_name.txt
"""

import json
from pathlib import Path
from datetime import datetime

DEBUG_DIR = Path(__file__).parent.parent / "debugging"


def write_report(step: int, name: str, sections: list[dict]) -> Path:
    """
    Zapisuje raport do debugging/stepN_name.txt.

    sections: lista słowników z kluczami:
      title   str          — nagłówek sekcji
      stats   dict|None    — statystyki key→value wypisane na górze
      rows    list[str]    — linie do wypisania
      limit   int|None     — max wierszy w rows (None = wszystkie)
    """
    DEBUG_DIR.mkdir(parents=True, exist_ok=True)
    out = DEBUG_DIR / f"step{step}_{name}.txt"

    lines = []
    lines.append(f"# Krok {step}: {name.replace('_', ' ')}")
    lines.append(f"# Wygenerowano: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("")

    for sec in sections:
        lines.append("=" * 70)
        lines.append(f"  {sec['title']}")
        lines.append("=" * 70)

        if sec.get("stats"):
            for k, v in sec["stats"].items():
                lines.append(f"  {k:<40} {v}")
            lines.append("")

        rows  = sec.get("rows", [])
        limit = sec.get("limit")
        shown = rows[:limit] if limit else rows
        lines += ["  " + r for r in shown]
        if limit and len(rows) > limit:
            lines.append(f"  ... i {len(rows) - limit} więcej (truncated)")
        lines.append("")

    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"[debug] → {out.name}  ({len(lines)} linii)")
    return out
