from app.worker.jobs import process_job
from app.worker.queue import (
    UnknownJobTypeError,
    drain_testing_jobs,
    enqueue_job,
    reset_testing_jobs,
)


def test_enqueue_job_unknown_type_raises():
    reset_testing_jobs()
    enqueue_job({"type": "catalog_seed", "user_id": 1, "lang": "pl"})
    jobs = drain_testing_jobs()
    assert len(jobs) == 1
    try:
        process_job(jobs[0])
        raise AssertionError("expected UnknownJobTypeError")
    except UnknownJobTypeError as exc:
        assert "catalog_seed" in str(exc)


def test_register_does_not_enqueue_catalog_seed(client, db_session):
    reset_testing_jobs()
    reg = client.post(
        "/api/auth/register",
        json={"username": "noworker2", "password": "secret123", "lang": "pl"},
    )
    assert reg.status_code == 201
    jobs = drain_testing_jobs()
    assert jobs == []
