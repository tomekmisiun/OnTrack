from __future__ import annotations

import logging

from app.db.session import get_session_factory
from app.services.catalog_seed_service import ensure_user_seeded
from app.worker.queue import JOB_CATALOG_SEED, UnknownJobTypeError

logger = logging.getLogger(__name__)


def run_catalog_seed(user_id: int, lang: str) -> None:
    session = get_session_factory()()
    try:
        ensure_user_seeded(session, user_id, lang)
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def process_job(job: dict) -> None:
    job_type = job.get("type")
    if job_type == JOB_CATALOG_SEED:
        run_catalog_seed(int(job["user_id"]), str(job.get("lang") or "pl"))
        return
    raise UnknownJobTypeError(f"Unknown job type: {job_type!r}")
