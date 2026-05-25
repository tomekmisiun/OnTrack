"""
Shared module for generating debug reports for each pipeline step.
Each step calls write_report(step, name, sections) at the end of main().
Output lands in scraper/debugging/stepN_name.txt
"""

import json
from pathlib import Path
from datetime import datetime

DEBUG_DIR = Path(__file__).parent.parent / "debugging"


def write_report(step: int, name: str, sections: list[dict]) -> Path:
    """
    Write a report to debugging/stepN_name.txt.

    sections: list of dicts with keys:
      title   str          — section heading
      stats   dict|None    — key→value stats printed at the top
      rows    list[str]    — lines to print
      limit   int|None     — max rows to show (None = all)
    """
    DEBUG_DIR.mkdir(parents=True, exist_ok=True)
    out = DEBUG_DIR / f"step{step}_{name}.txt"

    lines = []
    lines.append(f"# Step {step}: {name.replace('_', ' ')}")
    lines.append(f"# Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
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
