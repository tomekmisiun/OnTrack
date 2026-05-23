"""Map PL recipe titles to their English pipeline names (for Pexels search)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).parent.parent
RECIPES_PL = ROOT / "scraper" / "data" / "recipes_pl.json"
SEED_PL = ROOT / "app" / "data" / "recipes_seed_pl.json"


@lru_cache(maxsize=1)
def pl_name_en_lookup() -> tuple[dict[str, str], dict[str, str]]:
    """
    Build lookups from accepted PL catalog recipes:
      source_url -> name_en
      name_pl (lower) -> name_en
    """
    by_url: dict[str, str] = {}
    by_pl: dict[str, str] = {}

    for path in (RECIPES_PL, SEED_PL):
        if not path.exists():
            continue
        try:
            rows = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        for row in rows:
            name_en = (row.get("name_en") or "").strip()
            if not name_en:
                continue
            url = (row.get("url") or row.get("source_url") or "").strip()
            name_pl = (row.get("name_pl") or row.get("name") or "").strip()
            if url:
                by_url[url] = name_en
            if name_pl:
                by_pl[name_pl.lower()] = name_en

    return by_url, by_pl


def english_name_for_recipe(
    recipe_name: str,
    source_url: str | None = None,
    lang: str | None = "pl",
) -> str | None:
    """Return pipeline English name for a PL recipe, if known."""
    if lang and lang != "pl":
        return None

    by_url, by_pl = pl_name_en_lookup()
    url = (source_url or "").strip()
    if url and url in by_url:
        return by_url[url]

    key = (recipe_name or "").strip().lower()
    return by_pl.get(key)
