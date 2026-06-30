from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

from app.core.security import create_access_token, decode_access_token
from app.models.product import Product
from app.models.recipe import Recipe
from app.models.user import User
from werkzeug.security import generate_password_hash

from tests.conftest import create_user


def test_exchange_requires_code(client):
    res = client.post("/api/auth/exchange", json={})
    assert res.status_code == 400
    assert "Code is required" in res.json()["error"]


def test_exchange_rejects_invalid_code(client):
    res = client.post("/api/auth/exchange", json={"code": "not-a-real-code"})
    assert res.status_code == 401


def test_exchange_issues_jwt_once(client, user, issue_auth_code):
    code = issue_auth_code(user.id, ttl_seconds=120)
    res = client.post("/api/auth/exchange", json={"code": code})
    assert res.status_code == 200
    assert "token" in res.json()

    again = client.post("/api/auth/exchange", json={"code": code})
    assert again.status_code == 401


def test_me_requires_auth(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401
    assert res.json()["error"] == "Authentication required"


def test_me_returns_user(client, user, auth_headers):
    res = client.get("/api/auth/me", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == user.email
    assert data["lang"] == "pl"
    assert data["ui_locale"] == "pl"
    assert data["market_code"] == "PL"


def test_refresh_issues_new_token(client, user, auth_headers):
    res = client.post("/api/auth/refresh", headers=auth_headers)
    assert res.status_code == 200
    assert "token" in res.json()
    assert decode_access_token(res.json()["token"]) == user.id


def test_change_password(client, db_session):
    user = create_user(db_session, "alice@example.com", lang="pl", username="aliceuser")
    headers = {"Authorization": f"Bearer {create_access_token(user.id)}"}
    res = client.patch(
        "/api/auth/password",
        headers=headers,
        json={"current_password": "test-password", "new_password": "NewPass123!"},
    )
    assert res.status_code == 200
    login = client.post(
        "/api/auth/login",
        json={"email": "alice@example.com", "password": "NewPass123!"},
    )
    assert login.status_code == 200


def test_change_password_rejects_wrong_current(client, db_session):
    user = create_user(db_session, "bob@example.com", lang="pl", username="bobuser")
    headers = {"Authorization": f"Bearer {create_access_token(user.id)}"}
    res = client.patch(
        "/api/auth/password",
        headers=headers,
        json={"current_password": "wrong-password", "new_password": "NewPass123!"},
    )
    assert res.status_code == 400
    assert res.json()["error"] == "Invalid current password"


def test_forgot_password_returns_token_in_testing(client, db_session):
    create_user(db_session, "reset@example.com", lang="pl", username="resetuser")
    res = client.post("/api/auth/forgot-password", json={"email": "reset@example.com"})
    assert res.status_code == 200
    data = res.json()
    assert "reset_token" in data
    reset = client.post(
        "/api/auth/reset-password",
        json={"token": data["reset_token"], "new_password": "ResetPass123!"},
    )
    assert reset.status_code == 200
    assert "token" in reset.json()


def test_forgot_password_sends_email_when_smtp_configured(client, db_session, monkeypatch):
    create_user(db_session, "oauth@example.com", lang="pl", username="mailuser")
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_FROM", "noreply@example.com")
    from app.core.config import get_settings

    get_settings.cache_clear()

    with patch("app.services.auth_service.send_password_reset_email") as send_mock:
        res = client.post("/api/auth/forgot-password", json={"email": "oauth@example.com"})
    assert res.status_code == 200
    assert "reset_token" not in res.json()
    send_mock.assert_called_once()


def test_change_language(client, user, auth_headers, db_session):
    res = client.patch(
        "/api/auth/language",
        headers=auth_headers,
        json={"lang": "en"},
    )
    assert res.status_code == 200
    assert res.json()["lang"] == "en"
    assert res.json()["ui_locale"] == "en"

    db_session.refresh(user)
    assert user.ui_locale == "en"
    assert user.ui_locale == "en"


def test_change_language_rejects_invalid(client, auth_headers):
    res = client.patch(
        "/api/auth/language",
        headers=auth_headers,
        json={"lang": "de"},
    )
    assert res.status_code == 400


def test_register_and_login(client, db_session):
    reg = client.post(
        "/api/auth/register",
        json={"email": "testuser@example.com", "password": "secret123", "lang": "en"},
    )
    assert reg.status_code == 201
    assert "token" in reg.json()
    assert "access_token" not in reg.json()

    user = db_session.query(User).filter(User.email.ilike("testuser@example.com")).first()
    assert user is not None
    assert user.email == "testuser@example.com"
    assert user.username == "testuser"
    assert user.ui_locale == "en"
    assert user.market_code == "GB"
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {reg.json()['token']}"})
    assert me.json()["email"] == "testuser@example.com"

    login = client.post(
        "/api/auth/login",
        json={"email": "testuser@example.com", "password": "secret123"},
    )
    assert login.status_code == 200
    assert "token" in login.json()


def test_login_rejects_wrong_password(client):
    client.post(
        "/api/auth/register",
        json={"email": "alice2@example.com", "password": "secret123", "lang": "pl"},
    )
    res = client.post(
        "/api/auth/login",
        json={"email": "alice2@example.com", "password": "wrong-password"},
    )
    assert res.status_code == 401


def test_register_rejects_duplicate_email(client):
    payload = {"email": "dup@example.com", "password": "secret123", "lang": "pl"}
    assert client.post("/api/auth/register", json=payload).status_code == 201
    assert client.post("/api/auth/register", json=payload).status_code == 409


def test_register_validates_email(client):
    res = client.post(
        "/api/auth/register",
        json={"email": "not-an-email", "password": "secret123", "lang": "pl"},
    )
    assert res.status_code == 400


def test_register_sees_global_catalog_not_private_products(client, db_session, global_catalog):
    reg = client.post(
        "/api/auth/register",
        json={"email": "seeduser1@example.com", "password": "secret123", "lang": "pl"},
    )
    assert reg.status_code == 201
    user = db_session.query(User).filter(User.email.ilike("seeduser1@example.com")).first()
    assert db_session.query(Product).filter_by(user_id=user.id).count() == 0
    assert db_session.query(Recipe).filter_by(user_id=user.id).count() == 0


def test_werkzeug_hash_from_flask_login_works(client, db_session):
    user = User(
        email="legacy@example.com",
        username="legacyuser",
        ui_locale="pl",
        market_code="PL",
        password_hash=generate_password_hash("secret123"),
    )
    db_session.add(user)
    db_session.commit()

    res = client.post(
        "/api/auth/login",
        json={"email": "legacy@example.com", "password": "secret123"},
    )
    assert res.status_code == 200
    assert "token" in res.json()


def test_flask_jwt_validates_on_fastapi(client, user):
    from app.core.config import get_settings
    from flask import Flask
    from flask_jwt_extended import JWTManager
    from flask_jwt_extended import create_access_token as flask_create_token

    flask_app = Flask(__name__)
    flask_app.config["JWT_SECRET_KEY"] = get_settings().jwt_secret_key
    JWTManager(flask_app)

    with flask_app.app_context():
        flask_token = flask_create_token(identity=str(user.id))

    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {flask_token}"})
    assert res.status_code == 200
    assert res.json()["id"] == user.id


def test_fastapi_jwt_decodes_with_same_sub(user):
    token = create_access_token(user.id)
    assert decode_access_token(token) == user.id


def test_google_login_stores_lang_cookie(client, monkeypatch):
    from app.api.routes import auth as auth_routes

    captured: dict = {}

    class FakeGoogle:
        async def authorize_redirect(self, _request, _uri, **kwargs):
            captured.update(kwargs)
            from starlette.responses import RedirectResponse

            return RedirectResponse("https://accounts.google.com/o/oauth2/v2/auth")

    class FakeOAuth:
        google = FakeGoogle()

    monkeypatch.setattr(auth_routes, "_oauth", FakeOAuth())

    res = client.get("/api/auth/google?lang=pl", follow_redirects=False)
    assert res.status_code in (302, 307)
    assert "accounts.google.com" in res.headers["location"]
    assert "pending_lang=pl" in res.headers.get("set-cookie", "")
    assert captured.get("prompt") == "select_account"


def test_google_login_redirects_when_not_configured(client, monkeypatch):
    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(
        settings,
        "google_client_id",
        None,
        raising=False,
    )
    monkeypatch.setattr(
        settings,
        "google_client_secret",
        None,
        raising=False,
    )

    res = client.get("/api/auth/google?lang=pl", follow_redirects=False)
    assert res.status_code == 302
    location = res.headers["location"]
    assert "/login" in location
    assert "auth_error=oauth_not_configured" in location


def test_google_callback_redirects_with_exchange_code(client, db_session, monkeypatch):
    from app.api.routes import auth as auth_routes

    class FakeGoogle:
        async def authorize_access_token(self, _request):
            return {"userinfo": {"email": "oauth-new@example.com"}}

    class FakeOAuth:
        google = FakeGoogle()

    monkeypatch.setattr(auth_routes, "_oauth", FakeOAuth())

    res = client.get(
        "/api/auth/google/callback",
        headers={"Cookie": "pending_lang=pl"},
        follow_redirects=False,
    )
    assert res.status_code == 302
    assert res.headers["location"].startswith("http://localhost:3000/")
    query = parse_qs(urlparse(res.headers["location"]).query)
    assert "code" in query

    user = db_session.query(User).filter_by(email="oauth-new@example.com").first()
    assert user is not None
    assert user.ui_locale == "pl"
    assert user.market_code == "PL"

    exchange = client.post("/api/auth/exchange", json={"code": query["code"][0]})
    assert exchange.status_code == 200
    assert "token" in exchange.json()


def test_google_callback_missing_email_redirects_with_error(client, monkeypatch):
    from app.api.routes import auth as auth_routes

    class FakeGoogle:
        async def authorize_access_token(self, _request):
            return {"userinfo": {"email": ""}}

    monkeypatch.setattr(auth_routes, "_oauth", type("O", (), {"google": FakeGoogle()})())

    res = client.get("/api/auth/google/callback", follow_redirects=False)
    assert res.status_code == 302
    assert "auth_error=oauth_no_email" in res.headers["location"]
    assert "/login" in res.headers["location"]


def test_delete_account(client, user, auth_headers, db_session):
    res = client.delete("/api/auth/me", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["message"] == "Account deleted"
    assert db_session.get(User, user.id) is None


def test_delete_account_with_recipe_favorites(
    client, user, auth_headers, db_session, global_catalog
):
    recipes = client.get("/api/recipes/", headers=auth_headers).json()
    assert recipes
    recipe_id = recipes[0]["id"]
    fav = client.patch(f"/api/recipes/{recipe_id}/favorite", headers=auth_headers)
    assert fav.status_code == 200
    assert fav.json()["is_favorite"] is True

    res = client.delete("/api/auth/me", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["message"] == "Account deleted"
    assert db_session.get(User, user.id) is None


def test_auth_login_rate_limit(client):
    from app.core.rate_limit import reset_rate_limits

    reset_rate_limits()
    payload = {"email": "nobody@example.com", "password": "wrong-password"}
    for _ in range(20):
        res = client.post("/api/auth/login", json=payload)
        assert res.status_code in (401, 400)
    blocked = client.post("/api/auth/login", json=payload)
    assert blocked.status_code == 429
    assert blocked.json()["error"] == "Too many requests"
    reset_rate_limits()


def test_oauth_callback_redacts_internal_errors(client, monkeypatch):
    from app.api.routes import auth as auth_routes

    class FakeGoogle:
        async def authorize_access_token(self, _request):
            raise RuntimeError("internal database connection string leaked")

    monkeypatch.setattr(auth_routes, "_oauth", type("O", (), {"google": FakeGoogle()})())

    res = client.get("/api/auth/google/callback", follow_redirects=False)
    assert res.status_code == 302
    location = res.headers["location"]
    assert "auth_error=oauth_failed" in location
    assert "/login" in location
    assert "RuntimeError" not in location
    assert "database" not in location.lower()
