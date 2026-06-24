"""Product name normalization for search and indexing."""

from __future__ import annotations

import re
import unicodedata

_PL_TRANSLATE = str.maketrans("ąćęłńóśźż", "acelnoszz")


def normalize_product_name(name: str) -> str:
    """Stable normalized key from display name (aligned with macro dedup_key style)."""
    s = unicodedata.normalize("NFKD", (name or "").strip().lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.translate(_PL_TRANSLATE).replace("-", "")
    return re.sub(r"\s+", " ", s)[:255]
