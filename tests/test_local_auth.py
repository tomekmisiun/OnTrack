from app.models.user import User
from app.models.product import Product
from app.models.recipe import Recipe


def test_register_seeds_catalog(client):
    reg = client.post(
        "/api/auth/register",
        json={
            "username": "seeduser1",
            "password": "secret123",
            "lang": "pl",
        },
    )
    assert reg.status_code == 201
    user = User.query.filter_by(username="seeduser1").first()
    assert Product.query.filter_by(user_id=user.id, lang="pl").count() > 50
    assert Recipe.query.filter_by(user_id=user.id, lang="pl").count() > 10

    reg2 = client.post(
        "/api/auth/register",
        json={
            "username": "seeduser2",
            "password": "secret123",
            "lang": "pl",
        },
    )
    assert reg2.status_code == 201
    user2 = User.query.filter_by(username="seeduser2").first()
    assert Product.query.filter_by(user_id=user2.id, lang="pl").count() > 50
    assert Recipe.query.filter_by(user_id=user2.id, lang="pl").count() > 10


def test_register_and_login(client):
    reg = client.post(
        "/api/auth/register",
        json={
            "username": "TestUser",
            "password": "secret123",
            "lang": "en",
        },
    )
    assert reg.status_code == 201
    assert "token" in reg.get_json()

    user = User.query.filter_by(username="testuser").first()
    assert user is not None
    assert user.email == "testuser@users.ontrack.local"
    assert user.lang == "en"
    assert "email" not in user.to_dict()

    login = client.post(
        "/api/auth/login",
        json={"username": "testuser", "password": "secret123"},
    )
    assert login.status_code == 200
    assert "token" in login.get_json()


def test_login_rejects_wrong_password(client):
    client.post(
        "/api/auth/register",
        json={
            "username": "alice2",
            "password": "secret123",
            "lang": "pl",
        },
    )
    res = client.post(
        "/api/auth/login",
        json={"username": "alice2", "password": "wrong-password"},
    )
    assert res.status_code == 401


def test_register_rejects_duplicate_username(client):
    payload = {
        "username": "dupuser",
        "password": "secret123",
        "lang": "pl",
    }
    assert client.post("/api/auth/register", json=payload).status_code == 201

    res = client.post("/api/auth/register", json=payload)
    assert res.status_code == 409


def test_register_validates_username(client):
    res = client.post(
        "/api/auth/register",
        json={
            "username": "ab",
            "password": "secret123",
            "lang": "pl",
        },
    )
    assert res.status_code == 400
