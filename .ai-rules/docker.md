# Docker Rules

Container and compose conventions for the target repository.

## Safety

- MUST NOT commit secrets in Dockerfiles, compose files, or image build args.
- Production runtime settings MUST align with application configuration.
- Do not add new compose services without explicit approval.

## Changes

- Document production-impacting CMD, port, health check, or CORS changes in
  deployment documentation.
- Keep local development compose aligned with documented environment variables.

## Validation

- Run the container build or compose validation command defined by the target
  repository after Docker changes.
