# Threat Modeling

Required for changes touching **auth, permissions, sensitive data, uploads,
webhooks, queues, workers, external integrations**, or agent-controlled flows
that mutate production data.

Complements `.ai-rules/security.md`.

## Mini threat model template

1. **Change summary** — what is being added or altered?
2. **Trust boundaries** — client → API → data stores → workers → external systems
3. **Assets at risk** — credentials, PII, tenant data, files, queue jobs
4. **Actors** — anonymous, authenticated user, admin, worker, external sender
5. **Abuse cases** — IDOR, unauthorized access, token replay, webhook replay,
   upload abuse, rate-limit bypass, job poisoning
6. **Mitigations** — existing or new controls
7. **Required tests** — map each abuse case to a test or explicit gap
8. **Validation** — validation command from target repo + targeted security tests

## Review hotspots (customize per target repo)

| Area | Inspect |
|------|---------|
| Auth | Auth services, session/token handling, permission dependencies |
| Admin | Role checks, audit logging |
| Data isolation | Scope filters, header/token cross-checks |
| Uploads | size/type validation, malware scanning if applicable |
| Webhooks | signatures, replay windows, rate limits |
| Workers | unknown job handling, idempotency, retries |
| Observability | metrics/admin endpoint exposure |

## Severity for findings

| Label | Meaning |
|-------|---------|
| Critical | Exploitable without auth or major data leak |
| High | Auth bypass, privilege escalation, secret exposure |
| Medium | Missing rate limit, weak validation, DoS vector |
| Low | Hardening, defense in depth, doc gap |

Use `.commands/security-audit.md` for a diff-scoped or full-repo audit prompt.
