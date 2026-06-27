"""Locale/market catalog model — neutral products, translations, market prices.

Revision ID: b1c2d3e4f5a6
Revises: a2b3c4d5e6f7
Create Date: 2026-06-27 12:00:00.000000

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, None] = "a2b3c4d5e6f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CURRENCY_BY_MARKET = {"PL": "PLN", "GB": "GBP"}


def upgrade() -> None:
    # --- new tables ---
    op.create_table(
        "product_translations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("locale", sa.String(length=5), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("product_id", "locale", name="uq_product_translations_product_locale"),
    )
    op.create_table(
        "product_market_prices",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("market_code", sa.String(length=10), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("package_weight", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(length=10), nullable=False, server_default="g"),
        sa.Column("sold_by_weight", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("product_id", "market_code", name="uq_product_market_prices_product_market"),
    )
    op.create_table(
        "recipe_translations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("recipe_id", sa.Integer(), sa.ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("locale", sa.String(length=5), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("recipe_id", "locale", name="uq_recipe_translations_recipe_locale"),
    )

    # --- user-owned rows: preserve name + market price before dropping columns ---
    op.add_column("products", sa.Column("user_name", sa.String(length=255), nullable=True))
    op.execute(
        sa.text("UPDATE products SET user_name = name WHERE user_id IS NOT NULL")
    )
    op.execute(
        sa.text(
            """
            INSERT INTO product_market_prices
                (product_id, market_code, amount, currency, package_weight, unit, sold_by_weight)
            SELECT
                id,
                market_code,
                COALESCE(price, 0),
                CASE market_code WHEN 'GB' THEN 'GBP' ELSE 'PLN' END,
                COALESCE(package_weight, 100),
                COALESCE(unit, 'g'),
                COALESCE(sold_by_weight, false)
            FROM products
            WHERE user_id IS NOT NULL
            """
        )
    )

    op.add_column("recipes", sa.Column("user_name", sa.String(length=255), nullable=True))
    # recipes.notes already exists on older schema — keep for user recipes

    op.execute(
        sa.text("UPDATE recipes SET user_name = name WHERE user_id IS NOT NULL")
    )

    # --- remove system catalog (re-seeded from canonical JSON) ---
    op.execute(
        sa.text(
            """
            DELETE FROM recipe_ingredients
            WHERE recipe_id IN (
                SELECT id FROM recipes WHERE source = 'system' AND user_id IS NULL
            )
            """
        )
    )
    op.execute(
        sa.text("DELETE FROM recipes WHERE source = 'system' AND user_id IS NULL")
    )
    op.execute(
        sa.text(
            """
            DELETE FROM recipe_ingredients
            WHERE product_id IN (
                SELECT id FROM products WHERE source = 'system' AND user_id IS NULL
            )
            """
        )
    )
    op.execute(
        sa.text("DELETE FROM products WHERE source = 'system' AND user_id IS NULL")
    )

    # --- drop old catalog indexes / constraints ---
    op.drop_index("uq_products_market_catalog_key_system", table_name="products")
    op.drop_index("uq_recipes_market_catalog_key_system", table_name="recipes")
    op.drop_index("ix_products_market_code", table_name="products")
    op.drop_index("ix_recipes_market_code", table_name="recipes")

    # --- drop legacy columns ---
    op.drop_column("products", "name")
    op.drop_column("products", "price")
    op.drop_column("products", "package_weight")
    op.drop_column("products", "unit")
    op.drop_column("products", "sold_by_weight")
    op.drop_column("products", "lang")
    op.drop_column("products", "market_code")

    op.drop_column("recipes", "name")
    op.drop_column("recipes", "lang")
    op.drop_column("recipes", "market_code")

    op.create_index(
        "uq_products_catalog_key_system",
        "products",
        ["catalog_key"],
        unique=True,
        postgresql_where=sa.text("user_id IS NULL AND catalog_key IS NOT NULL"),
    )
    op.create_index(
        "uq_recipes_catalog_key_system",
        "recipes",
        ["catalog_key"],
        unique=True,
        postgresql_where=sa.text("user_id IS NULL AND catalog_key IS NOT NULL"),
    )


def downgrade() -> None:
    raise NotImplementedError(
        "Downgrade not supported for locale/market catalog model migration — restore from backup."
    )
