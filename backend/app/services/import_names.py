"""Translate imported product names between PL and EN catalogs."""

from __future__ import annotations

import re
import unicodedata
from functools import lru_cache

from rapidfuzz import fuzz

from app.core.catalog_data import canonical_products_path, load_json_list

_PL_CHARS = re.compile(r"[ąćęłńóśźż]", re.I)


def _norm(name: str) -> str:
    s = unicodedata.normalize("NFKD", (name or "").strip().lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", s)


@lru_cache(maxsize=1)
def _pl_to_en_map() -> dict[str, str]:
    path = canonical_products_path()
    if not path.is_file():
        return {}
    out: dict[str, str] = {}
    for entry in load_json_list(path):
        names = entry.get("names") or {}
        pl = _norm(names.get("pl") or "")
        en = (names.get("en") or "").strip()
        if pl and en and pl not in out:
            out[pl] = en
    return out


def looks_polish(name: str) -> bool:
    return bool(_PL_CHARS.search(name))


def translate_product_name(name: str, lang: str) -> str:
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
