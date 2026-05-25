import io

from app.models.product import Product


def test_parse_receipt_without_gemini_key(client, auth_headers, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    data = {"file": (io.BytesIO(b"name,price\nTest,1.99"), "prices.txt")}
    res = client.post(
        "/api/import/parse",
        headers=auth_headers,
        data=data,
        content_type="multipart/form-data",
    )
    assert res.status_code == 503
    assert res.get_json()["code"] == "gemini_not_configured"


def test_parse_free_requires_file(client, auth_headers):
    res = client.post("/api/import/parse-free", headers=auth_headers)
    assert res.status_code == 400
    assert "No file provided" in res.get_json()["error"]


def test_parse_free_rejects_non_csv(client, auth_headers):
    data = {"file": (io.BytesIO(b"data"), "photo.jpg")}
    res = client.post(
        "/api/import/parse-free",
        headers=auth_headers,
        data=data,
        content_type="multipart/form-data",
    )
    assert res.status_code == 400


def test_parse_free_parses_csv_and_matches_product(client, auth_headers, product):
    csv_body = "nazwa,gramatura,jednostka,cena\nJogurt naturalny,400,g,3.49\n"
    data = {"file": (io.BytesIO(csv_body.encode()), "ceny.csv")}
    res = client.post(
        "/api/import/parse-free",
        headers=auth_headers,
        data=data,
        content_type="multipart/form-data",
    )
    assert res.status_code == 200
    items = res.get_json()["items"]
    assert len(items) == 1
    assert items[0]["receipt_name"] == "Jogurt naturalny"
    assert items[0]["matched_product"]["id"] == product.id


def test_apply_prices_updates_product(client, auth_headers, product):
    res = client.post(
        "/api/import/apply",
        headers=auth_headers,
        json={"updates": [{"product_id": product.id, "price": 4.25}]},
    )
    assert res.status_code == 200
    assert "Updated 1" in res.get_json()["message"]
    refreshed = Product.query.get(product.id)
    assert refreshed.price == 4.25


def test_apply_prices_ignores_other_users_product(client, auth_headers, other_user):
    foreign = Product(
        user_id=other_user.id,
        name="Cudzy produkt",
        package_weight=500,
        price=2.0,
        unit="g",
        lang="en",
    )
    from app import db
    db.session.add(foreign)
    db.session.commit()

    res = client.post(
        "/api/import/apply",
        headers=auth_headers,
        json={"updates": [{"product_id": foreign.id, "price": 9.99}]},
    )
    assert res.status_code == 200
    assert "Updated 0" in res.get_json()["message"]
