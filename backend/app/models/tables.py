"""OnTrack application tables (10). Excludes alembic_version."""

ONTRACK_TABLES = frozenset(
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
