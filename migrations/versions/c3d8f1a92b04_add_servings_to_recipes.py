"""add servings to recipes

Revision ID: c3d8f1a92b04
Revises: b7e2a9c41d03
Create Date: 2026-05-23 23:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'c3d8f1a92b04'
down_revision = 'b7e2a9c41d03'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('recipes', schema=None) as batch_op:
        batch_op.add_column(sa.Column('servings', sa.Integer(), nullable=False, server_default='1'))


def downgrade():
    with op.batch_alter_table('recipes', schema=None) as batch_op:
        batch_op.drop_column('servings')
