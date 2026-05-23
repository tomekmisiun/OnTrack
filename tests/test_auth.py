from app.models.auth_code import AuthCode
from app.models.user import User
from app import db


def test_exchange_requires_code(client):
    res = client.post("/api/auth/exchange", json={})
    assert res.status_code == 400
    assert "Code is required" in res.get_json()["error"]


def test_exchange_rejects_invalid_code(client):
    res = client.post("/api/auth/exchange", json={"code": "not-a-real-code"})
    assert res.status_code == 401


def test_exchange_issues_jwt_once(client, user):
    code = AuthCode.issue(user.id, ttl_seconds=120)
    res = client.post("/api/auth/exchange", json={"code": code})
    assert res.status_code == 200
    assert "token" in res.get_json()

    again = client.post("/api/auth/exchange", json={"code": code})
    assert again.status_code == 401


def test_me_requires_auth(client):
    assert client.get("/api/auth/me").status_code == 401


def test_me_returns_user(client, user, auth_headers):
    res = client.get("/api/auth/me", headers=auth_headers)
    assert res.status_code == 200
    data = res.get_json()
    assert data["email"] == user.email
    assert data["lang"] == "pl"


def test_change_language(client, user, auth_headers):
    res = client.patch(
        "/api/auth/language",
        headers=auth_headers,
        json={"lang": "en"},
    )
    assert res.status_code == 200
    assert res.get_json()["lang"] == "en"

    refreshed = User.query.get(user.id)
    assert refreshed.lang == "en"


def test_change_language_rejects_invalid(client, auth_headers):
    res = client.patch(
        "/api/auth/language",
        headers=auth_headers,
        json={"lang": "de"},
    )
    assert res.status_code == 400
