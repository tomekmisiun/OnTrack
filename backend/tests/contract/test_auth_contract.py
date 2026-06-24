from urllib.parse import parse_qs, urlparse

from app.core.security import create_access_token, decode_access_token
from app.models.product import Product
from app.models.recipe import Recipe
from app.models.user import User
from werkzeug.security import generate_password_hash


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


def test_change_language(client, user, auth_headers, db_session):
    res = client.patch(
        "/api/auth/language",
        headers=auth_headers,
        json={"lang": "en"},
    )
    assert res.status_code == 200
    assert res.json()["lang"] == "en"

    db_session.refresh(user)
    assert user.lang == "en"


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
        json={"username": "TestUser", "password": "secret123", "lang": "en"},
    )
    assert reg.status_code == 201
    assert "token" in reg.json()
    assert "access_token" not in reg.json()

    user = db_session.query(User).filter_by(username="testuser").first()
    assert user is not None
    assert user.email == "testuser@users.ontrack.local"
    assert user.lang == "en"
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {reg.json()['token']}"})
    assert "email" not in me.json()

    login = client.post(
        "/api/auth/login",
        json={"username": "testuser", "password": "secret123"},
    )
    assert login.status_code == 200
    assert "token" in login.json()


def test_login_rejects_wrong_password(client):
    client.post(
        "/api/auth/register",
        json={"username": "alice2", "password": "secret123", "lang": "pl"},
    )
    res = client.post(
        "/api/auth/login",
        json={"username": "alice2", "password": "wrong-password"},
    )
    assert res.status_code == 401


def test_register_rejects_duplicate_username(client):
    payload = {"username": "dupuser", "password": "secret123", "lang": "pl"}
    assert client.post("/api/auth/register", json=payload).status_code == 201
    assert client.post("/api/auth/register", json=payload).status_code == 409


def test_register_validates_username(client):
    res = client.post(
        "/api/auth/register",
        json={"username": "ab", "password": "secret123", "lang": "pl"},
    )
    assert res.status_code == 400


def test_register_seeds_catalog(client, db_session):
    reg = client.post(
        "/api/auth/register",
        json={"username": "seeduser1", "password": "secret123", "lang": "pl"},
    )
    assert reg.status_code == 201
    user = db_session.query(User).filter_by(username="seeduser1").first()
    assert db_session.query(Product).filter_by(user_id=user.id, lang="pl").count() >= 2
    assert db_session.query(Recipe).filter_by(user_id=user.id, lang="pl").count() >= 1


def test_werkzeug_hash_from_flask_login_works(client, db_session):
    user = User(
        email="legacy@example.com",
        username="legacyuser",
        lang="pl",
        password_hash=generate_password_hash("secret123"),
    )
    db_session.add(user)
    db_session.commit()

    res = client.post(
        "/api/auth/login",
        json={"username": "legacyuser", "password": "secret123"},
    )
    assert res.status_code == 200
    assert "token" in res.json()


def test_flask_jwt_validates_on_fastapi(client, user):
    from flask import Flask
    from flask_jwt_extended import JWTManager
    from flask_jwt_extended import create_access_token as flask_create_token

    from app.core.config import get_settings

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

    class FakeGoogle:
        async def authorize_redirect(self, _request, _uri):
            from starlette.responses import RedirectResponse

            return RedirectResponse("https://accounts.google.com/o/oauth2/v2/auth")

    class FakeOAuth:
        google = FakeGoogle()

    monkeypatch.setattr(auth_routes, "_oauth", FakeOAuth())

    res = client.get("/api/auth/google?lang=pl", follow_redirects=False)
    assert res.status_code in (302, 307)
    assert "accounts.google.com" in res.headers["location"]
    assert "pending_lang=pl" in res.headers.get("set-cookie", "")


def test_google_callback_redirects_with_exchange_code(client, db_session, monkeypatch):
    from app.api.routes import auth as auth_routes

    monkeypatch.setattr(
        "app.services.catalog_seed_service.ensure_user_seeded",
        lambda *_args, **_kwargs: None,
    )

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
    assert user.lang == "pl"

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
    assert "auth_error=" in res.headers["location"]


def test_delete_account(client, user, auth_headers, db_session):
    res = client.delete("/api/auth/me", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["message"] == "Account deleted"
    assert db_session.get(User, user.id) is None
