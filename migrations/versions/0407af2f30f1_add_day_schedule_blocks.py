"""add day_schedule_blocks

Revision ID: 0407af2f30f1
Revises: e5f6a7b8c9d0
Create Date: 2026-05-24 16:52:05.180366

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0407af2f30f1'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'day_schedule_blocks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('member_id', sa.Integer(), nullable=False),
        sa.Column('day', sa.Integer(), nullable=False),
        sa.Column('start_hour', sa.Integer(), nullable=False),
        sa.Column('end_hour', sa.Integer(), nullable=False),
        sa.Column('label', sa.String(length=120), nullable=False),
        sa.ForeignKeyConstraint(['member_id'], ['household_members.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade():
    op.drop_table('day_schedule_blocks')
