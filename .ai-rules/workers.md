# Workers and Background Jobs

Include this file in a target repository only when it uses background workers or
job queues. Remove or ignore it for synchronous-only applications.

## Rules

- Unknown job types MUST fail safely (dead-letter or explicit error), not
  succeed silently.
- Preserve idempotency, acknowledgment, and retry semantics when changing
  handlers.
- Do not rename queues or keys without a migration or rollout plan.

## Testing

- Handler tests for new job types and failure paths.
- Integration tests when queue behavior affects user-visible outcomes.

## Validation

Use the worker test commands defined in `.ai-rules/validation.md` for the
target repository.
