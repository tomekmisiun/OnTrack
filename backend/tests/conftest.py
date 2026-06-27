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
from app.domain.market import default_market_for_ui_locale  # noqa: E402
from app.domain.product_normalize import normalize_product_name  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models.household_member import HouseholdMember  # noqa: E402
from app.models.market import Market  # noqa: E402
from app.models.product import Product  # noqa: E402
from app.models.product_market_price import ProductMarketPrice  # noqa: E402
from app.models.recipe import Recipe, RecipeIngredient  # noqa: E402
from app.models.user import User  # noqa: E402
from app.scripts.import_catalog import import_catalog  # noqa: E402
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


def _ensure_markets(session: Session) -> None:
    if session.query(Market).count() > 0:
        return
    session.add_all(
        [
            Market(
                code="PL",
                name="Poland",
                default_locale="pl",
                currency_code="PLN",
                is_active=True,
            ),
            Market(
                code="GB",
                name="United Kingdom",
                default_locale="en",
                currency_code="GBP",
                is_active=True,
            ),
        ]
    )
    session.commit()


def create_user(
    session: Session,
    email: str,
    lang: str = "pl",
    username: str | None = None,
    *,
    market_code: str | None = None,
) -> User:
    _ensure_markets(session)
    ui_locale = lang if lang in ("pl", "en") else "pl"
    market = market_code or default_market_for_ui_locale(ui_locale)
    user = User(
        email=email,
        username=username,
        ui_locale=ui_locale,
        market_code=market,
        password_hash=hash_password("test-password"),
    )
    session.add(user)
    session.flush()
    session.add(
        HouseholdMember(
            user_id=user.id,
            name="Ja" if ui_locale == "pl" else "Me",
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
def global_catalog(db_session: Session):
    """Import generated global catalog for tests that need system products/recipes."""
    import_catalog(db_session)
    yield


@pytest.fixture
def product(db_session: Session, user: User) -> Product:
    p = Product(
        user_id=user.id,
        source="user",
        user_name="Jogurt naturalny",
        normalized_name=normalize_product_name("Jogurt naturalny"),
        kcal=60,
        protein=4,
        fat=3,
        carbs=5,
    )
    p.market_prices.append(
        ProductMarketPrice(
            market_code="PL",
            amount=3.49,
            currency="PLN",
            package_weight=400,
            unit="g",
            sold_by_weight=False,
        )
    )
    db_session.add(p)
    db_session.commit()
    db_session.refresh(p)
    return p


@pytest.fixture
def recipe(db_session: Session, user: User, product: Product) -> Recipe:
    r = Recipe(
        user_name="Owsianka",
        user_id=user.id,
        source="user",
        category="breakfast",
        servings=1,
    )
    db_session.add(r)
    db_session.flush()
    db_session.add(RecipeIngredient(recipe_id=r.id, product_id=product.id, weight=200))
    db_session.commit()
    db_session.refresh(r)
    return r


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
