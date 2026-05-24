"""add username to users

Revision ID: d4e5f6a7b8c9
Revises: c3d8f1a92b04
Create Date: 2026-05-23 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'd4e5f6a7b8c9'
down_revision = 'c3d8f1a92b04'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('username', sa.String(length=80), nullable=True))
        batch_op.create_index(batch_op.f('ix_users_username'), ['username'], unique=True)


def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_users_username'))
        batch_op.drop_column('username')
