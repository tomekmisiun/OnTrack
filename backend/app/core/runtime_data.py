"""Central runtime data path resolution.

All backend consumers MUST resolve JSON/runtime assets through this module.
Legacy monorepo layout fallback is temporary — see TODO markers below.
"""

from __future__ import annotations

from pathlib import Path

from app.core.config import get_settings

# TODO(refactor/disconnect-scraper-from-backend): remove legacy monorepo fallback.


class RuntimeDataError(Exception):
    """Required runtime data file or directory is missing."""


def _backend_root() -> Path:
    """Directory containing backend/app/ (the backend package root)."""
    return Path(__file__).resolve().parents[2]


def _legacy_monorepo_root() -> Path:
    """Repository root when backend lives at repo/backend/ (monorepo layout)."""
    return Path(__file__).resolve().parents[3]


def _configured_runtime_root() -> Path | None:
    settings = get_settings()
    if settings.runtime_data_dir:
        return Path(settings.runtime_data_dir)
    return None


def runtime_data_root() -> Path | None:
    """Configured RUNTIME_DATA_DIR, or None when using legacy layout."""
    return _configured_runtime_root()


def seeds_dir() -> Path:
    settings = get_settings()
    if settings.user_seeds_dir:
        return Path(settings.user_seeds_dir)
    root = _configured_runtime_root()
    if root is not None:
        return root / "seeds"
    return _legacy_monorepo_root() / "app" / "user_seeds" / "data"


def dish_compare_data_dir() -> Path:
    root = _configured_runtime_root()
    if root is not None:
        return root / "dish_compare"
    return _legacy_monorepo_root() / "app" / "dish_compare" / "data"


def ingredients_macros_paths() -> tuple[Path, ...]:
    root = _configured_runtime_root()
    if root is not None:
        return (root / "macros" / "ingredients_macros.json",)
    legacy_root = _legacy_monorepo_root()
    return (
        legacy_root / "scraper" / "data" / "macros" / "ingredients_macros.json",
        legacy_root / "app" / "data" / "ingredients_macros.json",
    )


def recipes_pl_paths() -> tuple[Path, ...]:
    root = _configured_runtime_root()
    if root is not None:
        return (root / "recipes" / "recipes_pl.json",)
    legacy_root = _legacy_monorepo_root()
    return (
        legacy_root / "scraper" / "data" / "built" / "recipes_pl.json",
        legacy_root / "app" / "user_seeds" / "data" / "recipes_seed_pl.json",
    )


def macro_ai_cache_path() -> Path:
    root = _configured_runtime_root()
    if root is not None:
        return root / "cache" / "macro_ai_cache.json"
    return _legacy_monorepo_root() / "app" / "data" / "macro_ai_cache.json"


def required_runtime_files() -> tuple[tuple[Path, str], ...]:
    """Return (path, label) pairs that must exist for full API runtime."""
    dc = dish_compare_data_dir()
    return (
        (dc / "defaults" / "pl.json", "dish_compare defaults (pl)"),
        (dc / "defaults" / "en.json", "dish_compare defaults (en)"),
        (dc / "built" / "pl.json", "dish_compare built (pl)"),
        (dc / "built" / "en.json", "dish_compare built (en)"),
        *_required_ingredients_macros_entries(),
    )


def _required_ingredients_macros_entries() -> tuple[tuple[Path, str], ...]:
    for path in ingredients_macros_paths():
        if path.exists():
            return ((path, "ingredients_macros"),)
    primary = ingredients_macros_paths()[0]
    return ((primary, "ingredients_macros"),)


def validate_required_runtime_data() -> None:
    """Raise RuntimeDataError when a required runtime asset is missing."""
    missing: list[str] = []
    for path, label in required_runtime_files():
        if not path.is_file():
            missing.append(f"{label}: {path}")
    if not seeds_dir().is_dir():
        missing.append(f"seeds directory: {seeds_dir()}")
    if missing:
        raise RuntimeDataError(
            "Required runtime data missing:\n  - " + "\n  - ".join(missing)
        )
