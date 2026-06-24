from __future__ import annotations

import logging

from app.worker.queue import UnknownJobTypeError

logger = logging.getLogger(__name__)


def process_job(job: dict) -> None:
    raise UnknownJobTypeError(f"Unknown job type: {job.get('type')!r}")
