# Architecture Rules

Adapt these rules to the target repository's stack. Replace placeholder paths
with the actual layout documented in the target README or architecture docs.

## Layering

- Keep a clear separation between transport (HTTP/CLI), business logic, and data
  access.
- Business logic MUST NOT live in transport handlers when the project defines a
  service or domain layer.
- Dependencies MUST flow inward: transport → services → data access, not the
  reverse.

## Placeholder layout (customize per target repo)

| Layer | Typical location (replace) |
|-------|----------------------------|
| Routes / handlers | `<API_ROUTES_DIR>/` |
| Services / domain | `<SERVICE_DIR>/` |
| Models / schemas | `<MODEL_DIR>/`, `<SCHEMA_DIR>/` |
| Tests | `<TEST_DIR>/` |

## Rules

- One task equals one focused change set; avoid unrelated layer edits.
- No circular imports between layers.
- Shared utilities belong in a documented shared module, not duplicated.
- Breaking changes to public APIs MUST be documented in the same change set.

## Review triggers

Load this file for API changes, service refactors, and new modules. Pair with
`.ai-rules/api.md` and `.ai-rules/testing.md` when applicable.
