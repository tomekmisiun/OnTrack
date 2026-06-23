import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

# Env before app imports
os.environ.setdefault("TESTING", "1")
os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret-key-for-pytest")
os.environ.setdefault("FLASK_SECRET_KEY", "test-flask-secret-key-for-pytest")
os.environ.setdefault("GOOGLE_CLIENT_ID", "test-google-client-id")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "test-google-client-secret")
os.environ["DATABASE_URL"] = "sqlite://"

from app.api.dependencies import get_db_session  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.core.passwords import hash_password  # noqa: E402
from app.core.security import create_access_token  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models.household_member import HouseholdMember  # noqa: E402
from app.models.product import Product  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services import auth_service  # noqa: E402

get_settings.cache_clear()


@pytest.fixture
def engine():
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)


@pytest.fixture
def db_session(engine) -> Session:
    connection = engine.connect()
    transaction = connection.begin()
    SessionLocal = sessionmaker(bind=connection)
    session = SessionLocal()
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session: Session):
    app = create_app()

    def override_db():
        yield db_session

    app.dependency_overrides[get_db_session] = override_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def create_user(
    session: Session,
    email: str,
    lang: str = "pl",
    username: str | None = None,
) -> User:
    user = User(
        email=email,
        username=username,
        lang=lang,
        password_hash=hash_password("test-password"),
    )
    session.add(user)
    session.flush()
    session.add(
        HouseholdMember(
            user_id=user.id,
            name="Ja" if lang == "pl" else "Me",
            is_primary=True,
        )
    )
    session.commit()
    session.refresh(user)
    return user


@pytest.fixture
def user(db_session: Session) -> User:
    return create_user(db_session, "alice@example.com", lang="pl")


@pytest.fixture
def auth_headers(user: User) -> dict[str, str]:
    token = create_access_token(user.id)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def other_user(db_session: Session) -> User:
    return create_user(db_session, "bob@example.com", lang="en")


@pytest.fixture
def other_auth_headers(other_user: User) -> dict[str, str]:
    token = create_access_token(other_user.id)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def product(db_session: Session, user: User) -> Product:
    p = Product(
        user_id=user.id,
        name="Jogurt naturalny",
        package_weight=400,
        price=3.49,
        unit="g",
        kcal=60,
        protein=4,
        fat=3,
        carbs=5,
        lang="pl",
    )
    db_session.add(p)
    db_session.commit()
    db_session.refresh(p)
    return p


@pytest.fixture
def member(db_session: Session, user: User) -> HouseholdMember:
    return (
        db_session.query(HouseholdMember)
        .filter_by(user_id=user.id, is_primary=True)
        .first()
    )


@pytest.fixture
def issue_auth_code(db_session: Session):
    def _issue(user_id: int, ttl_seconds: int = 120) -> str:
        return auth_service.issue_auth_code(db_session, user_id, ttl_seconds=ttl_seconds)

    return _issue
