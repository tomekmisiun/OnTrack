"""add week_start to day_schedule_blocks

Revision ID: a1b2c3d4e5f6
Revises: 0407af2f30f1
Create Date: 2026-05-24 19:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'a1b2c3d4e5f6'
down_revision = '0407af2f30f1'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('day_schedule_blocks', sa.Column('week_start', sa.Date(), nullable=True))
    op.execute("""
        UPDATE day_schedule_blocks
        SET week_start = (CURRENT_DATE - ((EXTRACT(DOW FROM CURRENT_DATE)::int + 6) % 7))
        WHERE week_start IS NULL
    """)
    op.alter_column('day_schedule_blocks', 'week_start', nullable=False)


def downgrade():
    op.drop_column('day_schedule_blocks', 'week_start')
