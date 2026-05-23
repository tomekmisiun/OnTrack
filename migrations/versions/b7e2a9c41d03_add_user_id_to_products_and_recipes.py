"""add user_id and missing flags to products and recipes

Revision ID: b7e2a9c41d03
Revises: f4a8c1fbe932
Create Date: 2026-05-23 21:10:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = 'b7e2a9c41d03'
down_revision = 'f4a8c1fbe932'
branch_labels = None
depends_on = None


def _table_names(bind):
    return set(inspect(bind).get_table_names())


def _columns(bind, table):
    return {c['name'] for c in inspect(bind).get_columns(table)}


def _add_user_id(bind, table):
    cols = _columns(bind, table)
    if 'user_id' in cols:
        return
    with op.batch_alter_table(table, schema=None) as batch_op:
        batch_op.add_column(sa.Column('user_id', sa.Integer(), nullable=True))
    op.execute(sa.text(f"""
        UPDATE {table}
        SET user_id = (SELECT id FROM users ORDER BY id LIMIT 1)
        WHERE user_id IS NULL
    """))
    with op.batch_alter_table(table, schema=None) as batch_op:
        batch_op.create_foreign_key(f'fk_{table}_user_id', 'users', ['user_id'], ['id'])
        batch_op.alter_column('user_id', nullable=False)


def upgrade():
    bind = op.get_bind()
    tables = _table_names(bind)

    if 'products' in tables:
        _add_user_id(bind, 'products')
        if 'sold_by_weight' not in _columns(bind, 'products'):
            op.add_column(
                'products',
                sa.Column('sold_by_weight', sa.Boolean(), nullable=False, server_default=sa.text('false')),
            )
        if 'lang' in _columns(bind, 'products'):
            op.execute(sa.text("UPDATE products SET lang = 'pl' WHERE lang IS NULL"))

    if 'recipes' in tables:
        _add_user_id(bind, 'recipes')
        if 'is_favorite' not in _columns(bind, 'recipes'):
            op.add_column(
                'recipes',
                sa.Column('is_favorite', sa.Boolean(), nullable=False, server_default=sa.text('false')),
            )
        if 'lang' in _columns(bind, 'recipes'):
            op.execute(sa.text("UPDATE recipes SET lang = 'pl' WHERE lang IS NULL"))


def downgrade():
    bind = op.get_bind()
    tables = _table_names(bind)

    if 'recipes' in tables and 'is_favorite' in _columns(bind, 'recipes'):
        op.drop_column('recipes', 'is_favorite')

    if 'recipes' in tables and 'user_id' in _columns(bind, 'recipes'):
        with op.batch_alter_table('recipes', schema=None) as batch_op:
            batch_op.drop_constraint('fk_recipes_user_id', type_='foreignkey')
            batch_op.drop_column('user_id')

    if 'products' in tables and 'sold_by_weight' in _columns(bind, 'products'):
        op.drop_column('products', 'sold_by_weight')

    if 'products' in tables and 'user_id' in _columns(bind, 'products'):
        with op.batch_alter_table('products', schema=None) as batch_op:
            batch_op.drop_constraint('fk_products_user_id', type_='foreignkey')
            batch_op.drop_column('user_id')
