"""
Regenerate DIY costs for the login-page dish compare widget.

Usage (from repo root):
  python app/dish_compare/build.py
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _load_loader():
    import importlib.util

    path = ROOT / "app" / "dish_compare" / "loader.py"
    spec = importlib.util.spec_from_file_location("dish_compare_loader", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main() -> int:
    dcd = _load_loader()
    out_dir = dcd.dish_compare_root() / "built"
    out_dir.mkdir(parents=True, exist_ok=True)

    for lang in ("pl", "en"):
        payload = dcd.build_built_payload(lang)
        out_path = out_dir / f"{lang}.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
            f.write("\n")
        first = payload["dishes"][0]
        print(f"Wrote {out_path} ({len(payload['dishes'])} dishes, {first['id']} DIY={first['diy_cost']})")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, FileNotFoundError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
