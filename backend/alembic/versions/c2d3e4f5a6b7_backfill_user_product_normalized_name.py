"""Backfill user-owned product normalized_name from user_name.

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-06-27 18:00:00.000000

"""

from __future__ import annotations

import re
import unicodedata
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c2d3e4f5a6b7"
down_revision: Union[str, None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_PL_TRANSLATE = str.maketrans("ąćęłńóśźż", "acelnoszz")


def _normalize_name(name: str) -> str:
    s = unicodedata.normalize("NFKD", (name or "").strip().lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.translate(_PL_TRANSLATE).replace("-", "")
    return re.sub(r"\s+", " ", s)[:255]


def upgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            """
            SELECT id, user_name
            FROM products
            WHERE user_id IS NOT NULL
              AND user_name IS NOT NULL
              AND (normalized_name IS NULL OR normalized_name = '')
            """
        )
    ).fetchall()
    for row in rows:
        conn.execute(
            sa.text("UPDATE products SET normalized_name = :norm WHERE id = :id"),
            {"norm": _normalize_name(row.user_name), "id": row.id},
        )


def downgrade() -> None:
    pass
