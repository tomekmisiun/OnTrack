"""DEPRECATED runtime seeding — catalog is imported via ``import_catalog`` only.

Kept for migration tooling and backward-compatible test helpers.
"""

from __future__ import annotations

import warnings

from sqlalchemy.orm import Session


def ensure_user_seeded(session: Session, user_id: int, lang: str) -> None:
    warnings.warn(
        "ensure_user_seeded is deprecated; use import_catalog for global catalog",
        DeprecationWarning,
        stacklevel=2,
    )


def ensure_catalog_if_incomplete(session: Session, user_id: int, lang: str) -> None:
    warnings.warn(
        "ensure_catalog_if_incomplete is deprecated; global catalog is pre-imported",
        DeprecationWarning,
        stacklevel=2,
    )
