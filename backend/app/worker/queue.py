from __future__ import annotations

import json
import logging
from typing import Protocol

from app.core.config import get_settings

logger = logging.getLogger(__name__)

QUEUE_KEY = "ontrack:jobs"

_testing_jobs: list[dict] = []
_redis_client = None


class UnknownJobTypeError(ValueError):
    pass


class JobQueue(Protocol):
    def enqueue(self, job: dict) -> None: ...

    def dequeue(self, timeout_seconds: int = 5) -> dict | None: ...


def _get_redis():
    global _redis_client
    if _redis_client is None:
        import redis

        settings = get_settings()
        if not settings.redis_url:
            raise RuntimeError("REDIS_URL is not configured")
        _redis_client = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client


class RedisJobQueue:
    def enqueue(self, job: dict) -> None:
        _get_redis().lpush(QUEUE_KEY, json.dumps(job))

    def dequeue(self, timeout_seconds: int = 5) -> dict | None:
        result = _get_redis().brpop(QUEUE_KEY, timeout=timeout_seconds)
        if not result:
            return None
        _, payload = result
        return json.loads(payload)


def enqueue_job(job: dict) -> None:
    settings = get_settings()
    if settings.testing:
        _testing_jobs.append(job)
        return
    if settings.redis_url:
        RedisJobQueue().enqueue(job)
        return
    from app.worker.jobs import process_job

    process_job(job)


def dequeue_job(timeout_seconds: int = 5) -> dict | None:
    settings = get_settings()
    if settings.testing:
        return _testing_jobs.pop(0) if _testing_jobs else None
    if not settings.redis_url:
        return None
    return RedisJobQueue().dequeue(timeout_seconds=timeout_seconds)


def drain_testing_jobs() -> list[dict]:
    jobs = list(_testing_jobs)
    _testing_jobs.clear()
    return jobs


def reset_testing_jobs() -> None:
    _testing_jobs.clear()
