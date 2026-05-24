import os

import pytest
from flask_jwt_extended import create_access_token

# Secrets required before create_app() loads config.
os.environ.setdefault("FLASK_SECRET_KEY", "test-flask-secret-key-for-pytest")
os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret-key-for-pytest")
os.environ.setdefault("GOOGLE_CLIENT_ID", "test-google-client-id")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "test-google-client-secret")
# Force in-memory SQLite — CI has no Docker Postgres host "db".
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from app import create_app, db  # noqa: E402
from app.models.auth_code import AuthCode  # noqa: E402, F401
from app.models.day_schedule import DayScheduleBlock  # noqa: E402, F401
from app.models.household_member import HouseholdMember  # noqa: E402
from app.models.import_log import ImportLog  # noqa: E402, F401
from app.models.meal_plan import MealPlan  # noqa: E402, F401
from app.models.product import Product  # noqa: E402, F401
from app.models.recipe import Recipe, RecipeIngredient  # noqa: E402, F401
from app.models.recipe_parse_log import RecipeParseLog  # noqa: E402, F401
from app.models.user import User  # noqa: E402


@pytest.fixture
def app():
    application = create_app()
    application.config.update(
        TESTING=True,
        SQLALCHEMY_DATABASE_URI="sqlite:///:memory:",
    )
    with application.app_context():
        db.create_all()
        yield application
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


def create_user(email: str, lang: str = "pl") -> User:
    user = User(email=email, lang=lang)
    user.set_password("test-password")
    db.session.add(user)
    db.session.flush()
    db.session.add(
        HouseholdMember(
            user_id=user.id,
            name="Ja" if lang == "pl" else "Me",
            is_primary=True,
        )
    )
    db.session.commit()
    return user


@pytest.fixture
def user(app):
    return create_user("alice@example.com", lang="pl")


@pytest.fixture
def other_user(app):
    return create_user("bob@example.com", lang="en")


@pytest.fixture
def auth_headers(user):
    token = create_access_token(identity=str(user.id))
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def other_auth_headers(other_user):
    token = create_access_token(identity=str(other_user.id))
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def product(user):
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
    db.session.add(p)
    db.session.commit()
    return p


@pytest.fixture
def recipe(user, product):
    r = Recipe(name="Owsianka", user_id=user.id, category="breakfast", lang="pl")
    db.session.add(r)
    db.session.flush()
    db.session.add(
        RecipeIngredient(recipe_id=r.id, product_id=product.id, weight=200)
    )
    db.session.commit()
    return r


@pytest.fixture
def member(user):
    return HouseholdMember.query.filter_by(user_id=user.id, is_primary=True).first()
