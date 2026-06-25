"""Drop legacy users.lang column (replaced by ui_locale)

Revision ID: f1a2b3c4d5e6
Revises: e7f8a9b0c1d2
Create Date: 2026-06-25 13:30:00.000000

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "e7f8a9b0c1d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE users SET ui_locale = lang "
            "WHERE ui_locale IS NULL OR ui_locale = ''"
        )
    )
    op.drop_column("users", "lang")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column("lang", sa.String(length=5), nullable=True),
    )
    op.execute(sa.text("UPDATE users SET lang = ui_locale"))
    op.alter_column("users", "lang", nullable=False, server_default="pl")
