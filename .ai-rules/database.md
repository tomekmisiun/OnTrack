# Database Rules

Adapt to the target repository's ORM and migration tooling.

## Migrations

- Schema changes MUST include a migration when the project uses a migration tool.
- Do not edit applied migrations unless explicitly requested and safe.
- Destructive operations (drops, data loss) require explicit approval.

## Models

- Keep models in the directory defined by the target repository.
- Indexes and constraints MUST match new query patterns.
- No hardcoded database credentials in code or docs.

## Transactions

- Use the project's transaction/session patterns.
- Long-running operations outside request scope belong in workers when applicable.

## Testing

- Model and migration changes MUST include tests using the target repo's
  migration test patterns.
