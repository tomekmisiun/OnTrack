"""Restore user FK rows stashed during b1c2 catalog migration."""

from __future__ import annotations

import sys

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

STASH_TABLES = (
    "_ontrack_migration_meal_plan_stash",
    "_ontrack_migration_favorite_stash",
    "_ontrack_migration_ingredient_product_stash",
)


def _stash_tables_present(engine) -> bool:
    tables = set(inspect(engine).get_table_names())
    return all(name in tables for name in STASH_TABLES)


def restore_post_catalog_migration(session: Session) -> dict[str, int]:
    """Re-link meal plans, favorites, and ingredients to re-imported catalog rows."""
    stats = {
        "meal_plans_restored": 0,
        "favorites_restored": 0,
        "ingredients_restored": 0,
    }

    meal_rows = session.execute(
        text(
            """
            INSERT INTO meal_plans (user_id, member_id, date, position, recipe_id)
            SELECT s.user_id, s.member_id, s.date, s.position, r.id
            FROM _ontrack_migration_meal_plan_stash s
            JOIN recipes r
              ON r.catalog_key = s.catalog_key
             AND r.source = 'system'
             AND r.user_id IS NULL
            WHERE NOT EXISTS (
                SELECT 1
                FROM meal_plans mp
                WHERE mp.member_id IS NOT DISTINCT FROM s.member_id
                  AND mp.date = s.date
                  AND mp.position = s.position
            )
            """
        )
    ).rowcount
    stats["meal_plans_restored"] = meal_rows or 0

    favorite_rows = session.execute(
        text(
            """
            INSERT INTO user_recipe_favorites (user_id, recipe_id)
            SELECT s.user_id, r.id
            FROM _ontrack_migration_favorite_stash s
            JOIN recipes r
              ON r.catalog_key = s.catalog_key
             AND r.source = 'system'
             AND r.user_id IS NULL
            ON CONFLICT (user_id, recipe_id) DO NOTHING
            """
        )
    ).rowcount
    stats["favorites_restored"] = favorite_rows or 0

    ingredient_rows = session.execute(
        text(
            """
            INSERT INTO recipe_ingredients (recipe_id, product_id, weight)
            SELECT s.recipe_id, p.id, s.weight
            FROM _ontrack_migration_ingredient_product_stash s
            JOIN products p
              ON p.catalog_key = s.product_catalog_key
             AND p.source = 'system'
             AND p.user_id IS NULL
            WHERE NOT EXISTS (
                SELECT 1
                FROM recipe_ingredients ri
                WHERE ri.recipe_id = s.recipe_id
                  AND ri.product_id = p.id
            )
            """
        )
    ).rowcount
    stats["ingredients_restored"] = ingredient_rows or 0

    for table in STASH_TABLES:
        session.execute(text(f"DROP TABLE IF EXISTS {table}"))

    return stats


def main() -> None:
    settings = get_settings()
    engine = create_engine(settings.database_url)
    if not _stash_tables_present(engine):
        print("No catalog migration stash tables — skipping restore")
        return

    session_factory = sessionmaker(bind=engine)
    session = session_factory()
    try:
        stats = restore_post_catalog_migration(session)
        session.commit()
        print(
            "Restored catalog references:",
            f"meal_plans={stats['meal_plans_restored']},",
            f"favorites={stats['favorites_restored']},",
            f"ingredients={stats['ingredients_restored']}",
        )
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
        engine.dispose()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: restore_post_catalog_migration failed: {exc}", file=sys.stderr)
        raise
