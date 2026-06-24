"""ui_locale and market_code on users; markets reference table

Revision ID: e7f8a9b0c1d2
Revises: c4e5f6a7b8c9d1
Create Date: 2026-06-24 21:00:00.000000

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e7f8a9b0c1d2"
down_revision: Union[str, None] = "c4e5f6a7b8c9d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "markets",
        sa.Column("code", sa.String(length=10), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("default_locale", sa.String(length=5), nullable=False),
        sa.Column("currency_code", sa.String(length=3), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.PrimaryKeyConstraint("code"),
    )
    op.execute(
        sa.text(
            "INSERT INTO markets (code, name, default_locale, currency_code, is_active) "
            "VALUES ('PL', 'Poland', 'pl', 'PLN', true), "
            "('GB', 'United Kingdom', 'en', 'GBP', true)"
        )
    )

    op.add_column(
        "users",
        sa.Column("ui_locale", sa.String(length=5), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("market_code", sa.String(length=10), nullable=True),
    )

    op.execute(
        sa.text(
            "UPDATE users SET ui_locale = lang, "
            "market_code = CASE WHEN lang = 'en' THEN 'GB' ELSE 'PL' END"
        )
    )

    op.alter_column("users", "ui_locale", nullable=False, server_default="pl")
    op.alter_column("users", "market_code", nullable=False, server_default="PL")

    op.create_foreign_key(
        "fk_users_market_code",
        "users",
        "markets",
        ["market_code"],
        ["code"],
    )
    op.create_index("ix_users_market_code", "users", ["market_code"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_users_market_code", table_name="users")
    op.drop_constraint("fk_users_market_code", "users", type_="foreignkey")
    op.drop_column("users", "market_code")
    op.drop_column("users", "ui_locale")
    op.drop_table("markets")
