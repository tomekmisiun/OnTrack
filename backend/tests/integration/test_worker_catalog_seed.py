from app.core.passwords import hash_password
from app.models.household_member import HouseholdMember
from app.models.product import Product
from app.models.recipe import Recipe
from app.models.user import User
from app.worker.jobs import process_job
from app.worker.queue import (
    JOB_CATALOG_SEED,
    UnknownJobTypeError,
    dequeue_job,
    enqueue_catalog_seed,
    reset_testing_jobs,
)
from sqlalchemy.orm import sessionmaker


def _bare_user(db_session) -> User:
    user = User(
        email="worker-seed@example.com",
        lang="pl",
        password_hash=hash_password("test-password"),
    )
    db_session.add(user)
    db_session.flush()
    db_session.add(
        HouseholdMember(user_id=user.id, name="Ja", is_primary=True),
    )
    db_session.commit()
    db_session.refresh(user)
    return user


def test_catalog_seed_job_enqueue_and_process(db_session, engine, monkeypatch):
    bind = db_session.get_bind()
    monkeypatch.setattr(
        "app.worker.jobs.get_session_factory",
        lambda: sessionmaker(bind=bind, autocommit=False, autoflush=False),
    )
    reset_testing_jobs()
    user = _bare_user(db_session)
    assert db_session.query(Product).filter_by(user_id=user.id).count() == 0
    assert db_session.query(Recipe).filter_by(user_id=user.id).count() == 0

    enqueue_catalog_seed(user.id, "pl")
    job = dequeue_job()
    assert job is not None
    assert job["type"] == JOB_CATALOG_SEED
    assert job["user_id"] == user.id

    process_job(job)

    assert db_session.query(Product).filter_by(user_id=user.id, lang="pl").count() > 0
    assert db_session.query(Recipe).filter_by(user_id=user.id, lang="pl").count() > 0


def test_unknown_job_type_raises():
    try:
        process_job({"type": "not_a_real_job"})
        raise AssertionError("expected UnknownJobTypeError")
    except UnknownJobTypeError as exc:
        assert "not_a_real_job" in str(exc)


def test_auth_schedule_enqueues_catalog_seed(db_session, user):
    from app.services.auth_service import _schedule_catalog_seed

    reset_testing_jobs()
    _schedule_catalog_seed(user.id, "pl")
    job = dequeue_job()
    assert job == {"type": JOB_CATALOG_SEED, "user_id": user.id, "lang": "pl"}
