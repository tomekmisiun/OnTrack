"""global product catalog columns

Revision ID: c4e5f6a7b8c9d1
Revises: 7966d120d748
Create Date: 2026-05-26 12:00:00.000000

"""

from __future__ import annotations

import re
import unicodedata
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c4e5f6a7b8c9d1"
down_revision: Union[str, None] = "7966d120d748"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_PL_TRANSLATE = str.maketrans("ąćęłńóśźż", "acelnoszz")


def _normalize_name(name: str) -> str:
    s = unicodedata.normalize("NFKD", (name or "").strip().lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.translate(_PL_TRANSLATE).replace("-", "")
    return re.sub(r"\s+", " ", s)[:255]


def upgrade() -> None:
    op.add_column("products", sa.Column("source", sa.String(length=20), nullable=True))
    op.add_column("products", sa.Column("catalog_key", sa.String(length=120), nullable=True))
    op.add_column("products", sa.Column("base_product_id", sa.Integer(), nullable=True))
    op.add_column("products", sa.Column("normalized_name", sa.String(length=255), nullable=True))

    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, name FROM products")).fetchall()
    for row in rows:
        conn.execute(
            sa.text(
                "UPDATE products SET source = 'legacy', normalized_name = :norm "
                "WHERE id = :id"
            ),
            {"norm": _normalize_name(row.name), "id": row.id},
        )

    op.alter_column("products", "user_id", existing_type=sa.Integer(), nullable=True)
    op.alter_column("products", "source", nullable=False, server_default="legacy")
    op.alter_column("products", "normalized_name", nullable=False, server_default="")

    op.create_foreign_key(
        "fk_products_base_product_id",
        "products",
        "products",
        ["base_product_id"],
        ["id"],
    )

    op.create_check_constraint(
        "ck_products_system_user_id",
        "products",
        "(source = 'system' AND user_id IS NULL) OR "
        "(source != 'system' AND user_id IS NOT NULL)",
    )
    op.create_check_constraint(
        "ck_products_system_catalog_key",
        "products",
        "source != 'system' OR catalog_key IS NOT NULL",
    )

    op.create_index("ix_products_user_id_lang", "products", ["user_id", "lang"], unique=False)
    op.create_index(
        "ix_products_lang_normalized_name",
        "products",
        ["lang", "normalized_name"],
        unique=False,
    )
    op.create_index(
        "uq_products_lang_catalog_key_system",
        "products",
        ["lang", "catalog_key"],
        unique=True,
        postgresql_where=sa.text("user_id IS NULL AND catalog_key IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_products_lang_catalog_key_system", table_name="products")
    op.drop_index("ix_products_lang_normalized_name", table_name="products")
    op.drop_index("ix_products_user_id_lang", table_name="products")
    op.drop_constraint("ck_products_system_catalog_key", "products", type_="check")
    op.drop_constraint("ck_products_system_user_id", "products", type_="check")
    op.drop_constraint("fk_products_base_product_id", "products", type_="foreignkey")

    op.drop_column("products", "normalized_name")
    op.drop_column("products", "base_product_id")
    op.drop_column("products", "catalog_key")
    op.drop_column("products", "source")

    op.alter_column("products", "user_id", existing_type=sa.Integer(), nullable=False)
