# Security Rules

Production-ready mindset for all changes that affect runtime behavior.

## Secrets

- MUST NOT hardcode secrets or commit credentials, API keys, certificates, SSH
  keys, database dumps, `.env`, or local database files.
- MUST NOT add production-like secrets to config defaults, example env files,
  container files, or documentation. Use obvious placeholders only.
- If secrets are detected in changes, stop and warn the user.

## Auth and sessions

- Authentication logic MUST stay explicit and reviewable.
- Authorization MUST be enforced at the boundary defined by the target
  repository.
- MUST NOT remove or disable auth, permission checks, rate limits, webhook
  signature verification, or data-isolation checks without explicit user request.
- If a security-control test fails, fix the implementation or test. MUST NOT
  delete the control to make tests pass.

## Production config validators

- MUST NOT weaken production or staging configuration validators without
  explicit user request.

## API safety

- Validate input at the transport boundary using the project's validation
  approach.
- Use correct status codes and safe error messages.

## Data isolation

When the target application is multi-tenant or multi-scope, follow isolation
rules documented by that repository. If no isolation model exists, do not
assume one.
