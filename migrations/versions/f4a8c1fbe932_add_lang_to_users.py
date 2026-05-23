"""add lang to users

Revision ID: f4a8c1fbe932
Revises: e511409c0af6
Create Date: 2026-05-23 20:45:09.717256

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = 'f4a8c1fbe932'
down_revision = 'e511409c0af6'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = inspect(conn)
    if 'users' not in inspector.get_table_names():
        return
    if 'lang' in {c['name'] for c in inspector.get_columns('users')}:
        return
    op.add_column(
        'users',
        sa.Column('lang', sa.String(length=5), nullable=False, server_default='pl'),
    )


def downgrade():
    conn = op.get_bind()
    inspector = inspect(conn)
    if 'users' not in inspector.get_table_names():
        return
    if 'lang' not in {c['name'] for c in inspector.get_columns('users')}:
        return
    op.drop_column('users', 'lang')
