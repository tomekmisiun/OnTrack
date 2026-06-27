"""OnTrack application tables. Excludes alembic_version."""

ONTRACK_INITIAL_HEAD_TABLES = frozenset(
    {
        "auth_codes",
        "day_schedule_blocks",
        "household_members",
        "import_logs",
        "meal_plans",
        "products",
        "recipe_ingredients",
        "recipe_parse_logs",
        "recipes",
        "users",
    }
)

ONTRACK_TABLES = ONTRACK_INITIAL_HEAD_TABLES | {
    "markets",
    "user_recipe_favorites",
    "product_translations",
    "product_market_prices",
    "recipe_translations",
}

# Temporary tables created during b1c2 catalog migration; dropped after import_catalog restore.
MIGRATION_STASH_TABLES = frozenset(
    {
        "_ontrack_migration_meal_plan_stash",
        "_ontrack_migration_favorite_stash",
        "_ontrack_migration_ingredient_product_stash",
    }
)

# Tables from fastapi-production-foundation that must never appear in OnTrack DB.
FOUNDATION_FORBIDDEN_TABLES = frozenset(
    {
        "audit_logs",
        "files",
        "idempotency_keys",
        "job_runs",
        "password_reset_tokens",
        "refresh_tokens",
        "tenants",
        "uploads",
        "users_tenant",  # illustrative — any tenant-scoped extras
        "webhook_deliveries",
        "webhook_endpoints",
    }
)
