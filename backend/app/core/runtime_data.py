"""Central runtime data path resolution.

All backend consumers MUST resolve JSON/runtime assets through this module.
Default root is ``backend/data/`` (override with ``RUNTIME_DATA_DIR``).
"""

from __future__ import annotations

from pathlib import Path

from app.core.config import get_settings


class RuntimeDataError(Exception):
    """Required runtime data file or directory is missing."""


def _backend_root() -> Path:
    """Directory containing backend/app/ (the backend package root)."""
    return Path(__file__).resolve().parents[2]


def runtime_data_root() -> Path:
    """Resolved runtime data directory."""
    settings = get_settings()
    if settings.runtime_data_dir:
        return Path(settings.runtime_data_dir)
    return _backend_root() / "data"


def seeds_dir() -> Path:
    """Deprecated legacy seed path — prefer ``generated_dir()`` from catalog_data."""
    settings = get_settings()
    if settings.user_seeds_dir:
        return Path(settings.user_seeds_dir)
    return runtime_data_root() / "seeds"


def generated_catalog_dir() -> Path:
    return runtime_data_root() / "generated"


def dish_compare_data_dir() -> Path:
    return runtime_data_root() / "dish_compare"


def recipes_pl_paths() -> tuple[Path, ...]:
    return (runtime_data_root() / "recipes" / "recipes_pl.json",)


def macro_ai_cache_path() -> Path:
    return runtime_data_root() / "cache" / "macro_ai_cache.json"


def required_runtime_files() -> tuple[tuple[Path, str], ...]:
    """Return (path, label) pairs that must exist for full API runtime."""
    dc = dish_compare_data_dir()
    gen = generated_catalog_dir()
    return (
        (dc / "defaults" / "pl.json", "dish_compare defaults (pl)"),
        (dc / "defaults" / "en.json", "dish_compare defaults (en)"),
        (dc / "built" / "pl.json", "dish_compare built (pl)"),
        (dc / "built" / "en.json", "dish_compare built (en)"),
        (gen / "products_PL.json", "generated products (PL)"),
        (gen / "recipes_PL.json", "generated recipes (PL)"),
    )


def validate_required_runtime_data() -> None:
    """Raise RuntimeDataError when a required runtime asset is missing."""
    missing: list[str] = []
    for path, label in required_runtime_files():
        if not path.is_file():
            missing.append(f"{label}: {path}")
    if missing:
        raise RuntimeDataError(
            "Required runtime data missing:\n  - " + "\n  - ".join(missing)
        )
