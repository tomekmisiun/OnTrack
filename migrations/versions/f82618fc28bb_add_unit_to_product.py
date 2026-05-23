"""add unit to product

Revision ID: f82618fc28bb
Revises: b1f3c7f7e6a2
Create Date: 2026-05-13 11:27:12.240754

"""
from alembic import op
import sqlalchemy as sa


revision = 'f82618fc28bb'
down_revision = 'b1f3c7f7e6a2'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('products', schema=None) as batch_op:
        batch_op.add_column(sa.Column('unit', sa.String(length=10), nullable=False, server_default='g'))


def downgrade():
    with op.batch_alter_table('products', schema=None) as batch_op:
        batch_op.drop_column('unit')
