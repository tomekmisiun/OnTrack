"""drop global unique on product and recipe names

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-05-24 13:15:00.000000

Per-user catalogs need the same ingredient/recipe names across users.
Replace global UNIQUE(name) with per-user uniqueness on (user_id, lang, name).
"""
from alembic import op
from sqlalchemy import inspect


revision = 'e5f6a7b8c9d0'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def _drop_unique(bind, table, constraint):
    insp = inspect(bind)
    uniques = {uc['name'] for uc in insp.get_unique_constraints(table)}
    if constraint in uniques:
        op.drop_constraint(constraint, table, type_='unique')


def _add_per_user_unique(bind, table):
    insp = inspect(bind)
    name = f'uq_{table}_user_lang_name'
    uniques = {uc['name'] for uc in insp.get_unique_constraints(table)}
    if name not in uniques:
        op.create_unique_constraint(name, table, ['user_id', 'lang', 'name'])


def upgrade():
    bind = op.get_bind()
    tables = set(inspect(bind).get_table_names())
    if 'products' in tables:
        _drop_unique(bind, 'products', 'products_name_key')
        _add_per_user_unique(bind, 'products')
    if 'recipes' in tables:
        _drop_unique(bind, 'recipes', 'recipes_name_key')
        _add_per_user_unique(bind, 'recipes')


def downgrade():
    bind = op.get_bind()
    tables = set(inspect(bind).get_table_names())
    if 'products' in tables:
        op.drop_constraint('uq_products_user_lang_name', 'products', type_='unique')
        op.create_unique_constraint('products_name_key', 'products', ['name'])
    if 'recipes' in tables:
        op.drop_constraint('uq_recipes_user_lang_name', 'recipes', type_='unique')
        op.create_unique_constraint('recipes_name_key', 'recipes', ['name'])
