from app.models.user import User


def test_register_and_login(client):
    reg = client.post(
        "/api/auth/register",
        json={
            "username": "TestUser",
            "email": "testuser@example.com",
            "password": "secret123",
            "lang": "en",
        },
    )
    assert reg.status_code == 201
    assert "token" in reg.get_json()

    user = User.query.filter_by(username="testuser").first()
    assert user is not None
    assert user.email == "testuser@example.com"
    assert user.lang == "en"

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
            "email": "alice2@example.com",
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
        "email": "first@example.com",
        "password": "secret123",
        "lang": "pl",
    }
    assert client.post("/api/auth/register", json=payload).status_code == 201

    res = client.post(
        "/api/auth/register",
        json={**payload, "email": "second@example.com"},
    )
    assert res.status_code == 409


def test_register_validates_username(client):
    res = client.post(
        "/api/auth/register",
        json={
            "username": "ab",
            "email": "short@example.com",
            "password": "secret123",
            "lang": "pl",
        },
    )
    assert res.status_code == 400
