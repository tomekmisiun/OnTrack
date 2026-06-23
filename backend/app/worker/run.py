"""Background worker process — consumes Redis job queue."""

from __future__ import annotations

import logging
import signal
import sys

from app.worker.jobs import process_job
from app.worker.queue import UnknownJobTypeError, dequeue_job

logger = logging.getLogger(__name__)
_running = True


def _handle_stop(_signum, _frame) -> None:
    global _running
    _running = False


def run_worker() -> None:
    signal.signal(signal.SIGINT, _handle_stop)
    signal.signal(signal.SIGTERM, _handle_stop)
    logger.info("Worker started")
    while _running:
        job = dequeue_job(timeout_seconds=5)
        if job is None:
            continue
        try:
            process_job(job)
            logger.info("Processed job %s", job.get("type"))
        except UnknownJobTypeError:
            logger.error("Rejected unknown job: %s", job)
        except Exception:
            logger.exception("Job failed: %s", job)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    try:
        run_worker()
    except KeyboardInterrupt:
        pass
    sys.exit(0)


if __name__ == "__main__":
    main()
