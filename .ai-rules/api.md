# API Rules

HTTP/API conventions for the target repository. Replace version prefix and path
placeholders with values defined by the target project.

## Versioning

- Use the API version prefix defined by the target repository (document the
  exact prefix in README or architecture docs).
- Do not introduce a new version prefix without explicit user request.

## Handlers

- Handlers validate input, call services, map domain errors to HTTP responses.
- Handlers MUST NOT embed business rules or direct database queries when the
  project defines a service layer.
- Use the project's standard error envelope and status codes.

## Auth and authorization

- Protected routes MUST enforce authentication and authorization at the
  boundary defined by the target repository.
- Do not weaken auth checks to make tests pass.

## Documentation

- Update API documentation (OpenAPI, README, or `docs/`) when endpoints,
  request shapes, or error contracts change.

## Testing

- Every new or changed endpoint MUST have tests using the project's HTTP test
  client pattern.
