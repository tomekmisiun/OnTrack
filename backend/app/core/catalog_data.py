"""Catalog data layout: raw → canonical → generated.

See backend/data/README.md for responsibilities.
"""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.core.runtime_data import runtime_data_root
from app.domain.market import MARKET_BY_UI_LOCALE_DEFAULT, MARKET_CODES

MARKETS = tuple(sorted(MARKET_CODES))
MARKET_LOCALE = {market: locale for locale, market in MARKET_BY_UI_LOCALE_DEFAULT.items()}


def catalog_root() -> Path:
    return runtime_data_root()


def raw_dir() -> Path:
    return catalog_root() / "raw"


def canonical_dir() -> Path:
    return catalog_root() / "canonical"


def generated_dir() -> Path:
    return catalog_root() / "generated"


def canonical_products_path() -> Path:
    return canonical_dir() / "products.json"


def canonical_recipes_path() -> Path:
    return canonical_dir() / "recipes.json"


def generated_products_path(market_code: str) -> Path:
    return generated_dir() / f"products_{market_code}.json"


def generated_recipes_path(market_code: str) -> Path:
    return generated_dir() / f"recipes_{market_code}.json"


def user_snapshot_dir() -> Path:
    return raw_dir() / "user_1_catalog_snapshot"


def load_json_list(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict) and "items" in data:
        return data["items"]
    if isinstance(data, list):
        return data
    raise ValueError(f"{path}: expected list or {{items: [...]}}")


def canonical_version_hash(products: list[dict], recipes: list[dict]) -> str:
    payload = json.dumps({"p": products, "r": recipes}, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(payload.encode()).hexdigest()[:16]


def wrap_generated(
    items: list[dict], *, market_code: str, canonical_version: str
) -> dict[str, Any]:
    return {
        "meta": {
            "generated": True,
            "do_not_edit": True,
            "market_code": market_code,
            "canonical_version": canonical_version,
            "generated_at": datetime.now(UTC).replace(microsecond=0).isoformat(),
            "item_count": len(items),
        },
        "items": items,
    }


def write_generated(path: Path, envelope: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(envelope, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def read_generated_items(path: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return {}, data
    if isinstance(data, dict) and isinstance(data.get("items"), list):
        meta = data.get("meta") if isinstance(data.get("meta"), dict) else {}
        return meta, data["items"]
    raise ValueError(f"{path}: invalid generated catalog format")
