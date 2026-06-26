import io
from datetime import date

from app.domain.product_normalize import normalize_product_name
from app.models.import_log import ImportLog
from app.models.product import Product


def test_parse_receipt_without_gemini_key(client, auth_headers, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    res = client.post(
        "/api/import/parse",
        headers=auth_headers,
        files={"file": ("prices.txt", io.BytesIO(b"name,price\nTest,1.99"))},
    )
    assert res.status_code == 503
    assert res.json()["code"] == "gemini_not_configured"


def test_parse_free_requires_file(client, auth_headers):
    res = client.post("/api/import/parse-free", headers=auth_headers)
    assert res.status_code == 422


def test_parse_free_rejects_non_csv(client, auth_headers):
    res = client.post(
        "/api/import/parse-free",
        headers=auth_headers,
        files={"file": ("photo.jpg", io.BytesIO(b"data"))},
    )
    assert res.status_code == 400


def test_parse_free_parses_csv_and_matches_product(client, auth_headers, product):
    csv_body = "nazwa,gramatura,jednostka,cena\nJogurt naturalny,400,g,3.49\n"
    res = client.post(
        "/api/import/parse-free",
        headers=auth_headers,
        files={"file": ("ceny.csv", io.BytesIO(csv_body.encode()))},
    )
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) == 1
    assert items[0]["receipt_name"] == "Jogurt naturalny"
    assert items[0]["matched_product"]["id"] == product.id


def test_parse_free_enforces_daily_quota(client, auth_headers, user, db_session):
    db_session.add(ImportLog(user_id=user.id, date=date.today(), count=2))
    db_session.commit()
    res = client.post(
        "/api/import/parse-free",
        headers=auth_headers,
        files={"file": ("ceny.csv", io.BytesIO(b"name,price\nTest,1.99\n"))},
    )
    assert res.status_code == 429
    assert "Daily limit" in res.json()["error"]


def test_apply_prices_updates_product(client, auth_headers, product, db_session):
    res = client.post(
        "/api/import/apply",
        headers=auth_headers,
        json={"updates": [{"product_id": product.id, "price": 4.25}]},
    )
    assert res.status_code == 200
    assert "Updated 1" in res.json()["message"]
    db_session.refresh(product)
    assert product.price == 4.25


def test_apply_prices_ignores_other_users_product(client, auth_headers, other_user, db_session):
    foreign = Product(
        user_id=other_user.id,
        source="user",
        normalized_name=normalize_product_name("Cudzy produkt"),
        name="Cudzy produkt",
        package_weight=500,
        price=2.0,
        unit="g",
        lang="en",
    )
    db_session.add(foreign)
    db_session.commit()
    db_session.refresh(foreign)

    res = client.post(
        "/api/import/apply",
        headers=auth_headers,
        json={"updates": [{"product_id": foreign.id, "price": 9.99}]},
    )
    assert res.status_code == 200
    assert "Updated 0" in res.json()["message"]
