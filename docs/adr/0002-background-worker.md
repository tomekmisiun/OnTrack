# ADR 0002: Background worker and Redis queue

**Status:** Accepted  
**Date:** 2026-06-26  
**Context:** A Redis-backed worker scaffold existed but rejected all job types and was not deployed by CI.

## Decision drivers

- `process_job()` raised for every job type; no production code called `enqueue_job`.
- CI `deploy-production` deploys only `ontrack-back` and `ontrackapp`.
- Redis on Railway added cost without product value.
- Catalog seeding and imports run synchronously in the API process.

## Options considered

| Option | Description |
|--------|-------------|
| **A. Remove worker scaffold** | Delete worker package, Railway worker configs, Redis from local Compose. |
| **B. Keep scaffold, do not deploy** | Leave dead code and optional Railway service docs. |
| **C. Implement first real job** | e.g. async receipt parse; deploy worker in CI. |

## Decision

**Option A — remove the worker scaffold and Redis from local Compose.**

Reintroduce a queue only when a concrete async job is specified with acceptance criteria and CI deploy coverage.

## Consequences

- **Positive:** Architecture matches runtime behavior; lower ops confusion and Railway cost.
- **Positive:** Smaller backend dependency tree (no `redis` package).
- **Negative:** Future async work must re-add queue infrastructure deliberately.
- **Follow-up:** If async import parsing is needed, open a new ADR referencing this one.

## References

- [`project/current-state.md`](../project/current-state.md)
- Removed: `backend/app/worker/`, `backend/railway.worker*.toml`
