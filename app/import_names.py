"""Translate imported product names between PL and EN catalogs."""

from __future__ import annotations

import json
import re
import unicodedata
from functools import lru_cache
from pathlib import Path

from rapidfuzz import fuzz

_PL_CHARS = re.compile(r"[ąćęłńóśźż]", re.I)
from app.paths import SCRAPER_DATA

_MACROS_PATH = SCRAPER_DATA / "macros" / "ingredients_macros.json"


def _norm(name: str) -> str:
    s = unicodedata.normalize("NFKD", (name or "").strip().lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", s)


@lru_cache(maxsize=1)
def _pl_to_en_map() -> dict[str, str]:
    if not _MACROS_PATH.exists():
        return {}
    data = json.loads(_MACROS_PATH.read_text(encoding="utf-8"))
    out: dict[str, str] = {}
    for row in data:
        pl = _norm(row.get("name_pl") or "")
        en = (row.get("name_en") or "").strip()
        if pl and en and pl not in out:
            out[pl] = en
    return out


def looks_polish(name: str) -> bool:
    return bool(_PL_CHARS.search(name))


def translate_product_name(name: str, lang: str) -> str:
    """Map Polish ingredient names to English when importing into EN catalog."""
    if lang != "en" or not name:
        return name

    key = _norm(name)
    mapping = _pl_to_en_map()
    if key in mapping:
        return mapping[key]

    if not mapping or not looks_polish(name):
        return name

    best_name, best_score = name, 0
    for pl_key, en_name in mapping.items():
        score = fuzz.token_sort_ratio(key, pl_key)
        if score > best_score:
            best_score, best_name = score, en_name
    if best_score >= 88:
        return best_name
    return name
