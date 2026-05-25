from urllib.parse import parse_qs, urlparse

from app.models.auth_code import AuthCode
from app.models.user import User


def test_google_login_stores_lang_cookie(client, monkeypatch):
    from app.routes import auth as auth_mod

    def fake_redirect(_uri):
        from flask import redirect
        return redirect("https://accounts.google.com/o/oauth2/v2/auth")

    monkeypatch.setattr(auth_mod.oauth.google, "authorize_redirect", fake_redirect)

    res = client.get("/api/auth/google?lang=pl")
    assert res.status_code == 302
    assert "accounts.google.com" in res.location
    cookie = res.headers.get("Set-Cookie", "")
    assert "pending_lang=pl" in cookie


def test_google_callback_redirects_with_exchange_code(client, monkeypatch):
    from app.routes import auth as auth_mod

    monkeypatch.setattr("app.user_seeds.seed_user", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(
        auth_mod.oauth.google,
        "authorize_access_token",
        lambda *_a, **_k: {"userinfo": {"email": "oauth-new@example.com"}},
    )

    res = client.get("/api/auth/google/callback", headers={"Cookie": "pending_lang=pl"})
    assert res.status_code == 302
    assert res.location.startswith("http://localhost:3000/")
    query = parse_qs(urlparse(res.location).query)
    assert "code" in query

    user = User.query.filter_by(email="oauth-new@example.com").first()
    assert user is not None
    assert user.lang == "pl"

    exchange = client.post("/api/auth/exchange", json={"code": query["code"][0]})
    assert exchange.status_code == 200
    assert "token" in exchange.get_json()


def test_google_callback_existing_user_skips_seed(client, user, monkeypatch):
    from app.routes import auth as auth_mod

    called = {"seed": False}

    def track_seed(*_args, **_kwargs):
        called["seed"] = True

    monkeypatch.setattr("app.user_seeds.seed_user", track_seed)
    monkeypatch.setattr(
        auth_mod.oauth.google,
        "authorize_access_token",
        lambda *_a, **_k: {"userinfo": {"email": user.email}},
    )

    res = client.get("/api/auth/google/callback")
    assert res.status_code == 302
    assert called["seed"] is False
    assert "code=" in res.location


def test_google_callback_missing_email_redirects_with_error(client, monkeypatch):
    from app.routes import auth as auth_mod

    monkeypatch.setattr(
        auth_mod.oauth.google,
        "authorize_access_token",
        lambda *_a, **_k: {"userinfo": {"email": ""}},
    )

    res = client.get("/api/auth/google/callback")
    assert res.status_code == 302
    assert "auth_error=" in res.location
