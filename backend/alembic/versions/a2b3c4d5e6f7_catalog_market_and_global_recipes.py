"""catalog market_code and global system recipes

Revision ID: a2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2026-06-25 18:45:00.000000

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a2b3c4d5e6f7"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("products", sa.Column("market_code", sa.String(length=10), nullable=True))
    op.execute(
        sa.text(
            "UPDATE products SET market_code = CASE WHEN lang = 'en' THEN 'GB' ELSE 'PL' END "
            "WHERE market_code IS NULL"
        )
    )
    op.alter_column("products", "market_code", nullable=False, server_default="PL")

    op.add_column("recipes", sa.Column("source", sa.String(length=20), nullable=True))
    op.add_column("recipes", sa.Column("catalog_key", sa.String(length=120), nullable=True))
    op.add_column("recipes", sa.Column("market_code", sa.String(length=10), nullable=True))

    op.execute(sa.text("UPDATE recipes SET source = 'user' WHERE source IS NULL"))
    op.execute(
        sa.text(
            "UPDATE recipes SET market_code = CASE WHEN lang = 'en' THEN 'GB' ELSE 'PL' END "
            "WHERE market_code IS NULL"
        )
    )

    op.alter_column("recipes", "user_id", existing_type=sa.Integer(), nullable=True)
    op.alter_column("recipes", "source", nullable=False, server_default="user")
    op.alter_column("recipes", "market_code", nullable=False, server_default="PL")

    op.create_check_constraint(
        "ck_recipes_system_user_id",
        "recipes",
        "(source = 'system' AND user_id IS NULL) OR "
        "(source != 'system' AND user_id IS NOT NULL)",
    )
    op.create_check_constraint(
        "ck_recipes_system_catalog_key",
        "recipes",
        "source != 'system' OR catalog_key IS NOT NULL",
    )

    op.create_index("ix_products_market_code", "products", ["market_code"], unique=False)
    op.create_index("ix_recipes_market_code", "recipes", ["market_code"], unique=False)
    op.create_index(
        "uq_products_market_catalog_key_system",
        "products",
        ["market_code", "catalog_key"],
        unique=True,
        postgresql_where=sa.text("user_id IS NULL AND catalog_key IS NOT NULL"),
    )
    op.create_index(
        "uq_recipes_market_catalog_key_system",
        "recipes",
        ["market_code", "catalog_key"],
        unique=True,
        postgresql_where=sa.text("user_id IS NULL AND catalog_key IS NOT NULL"),
    )

    op.create_table(
        "user_recipe_favorites",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("recipe_id", sa.Integer(), sa.ForeignKey("recipes.id"), nullable=False),
        sa.PrimaryKeyConstraint("user_id", "recipe_id"),
    )


def downgrade() -> None:
    op.drop_table("user_recipe_favorites")
    op.drop_index("uq_recipes_market_catalog_key_system", table_name="recipes")
    op.drop_index("uq_products_market_catalog_key_system", table_name="products")
    op.drop_index("ix_recipes_market_code", table_name="recipes")
    op.drop_index("ix_products_market_code", table_name="products")
    op.drop_constraint("ck_recipes_system_catalog_key", "recipes", type_="check")
    op.drop_constraint("ck_recipes_system_user_id", "recipes", type_="check")
    op.execute(sa.text("DELETE FROM recipes WHERE source = 'system' AND user_id IS NULL"))
    op.alter_column("recipes", "user_id", existing_type=sa.Integer(), nullable=False)
    op.drop_column("recipes", "market_code")
    op.drop_column("recipes", "catalog_key")
    op.drop_column("recipes", "source")
    op.drop_column("products", "market_code")
