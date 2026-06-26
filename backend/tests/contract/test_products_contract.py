from app.models.product import Product
from app.services.product_service import validate_product_data


def _items(body: dict | list) -> list:
    if isinstance(body, dict) and "items" in body:
        return body["items"]
    return body


def test_validate_product_data_requires_fields():
    assert validate_product_data({}) == "Required fields: name, package_weight, price"


def test_validate_product_data_rejects_empty_name():
    err = validate_product_data(
        {"name": "  ", "package_weight": 100, "price": 1.0},
        require_all=True,
    )
    assert err == "Product name cannot be empty"


def test_products_require_auth(client):
    assert client.get("/api/products/").status_code == 401


def test_create_and_list_products(client, auth_headers):
    res = client.post(
        "/api/products/",
        headers=auth_headers,
        json={
            "name": "Banany",
            "package_weight": 1000,
            "price": 6.99,
            "unit": "g",
        },
    )
    assert res.status_code == 201
    created = res.json()
    assert created["name"] == "Banany"

    listed = client.get("/api/products/", headers=auth_headers)
    assert listed.status_code == 200
    names = [p["name"] for p in _items(listed.json())]
    assert "Banany" in names


def test_update_product(client, auth_headers, product):
    res = client.put(
        f"/api/products/{product.id}",
        headers=auth_headers,
        json={"price": 4.99},
    )
    assert res.status_code == 200
    assert res.json()["price"] == 4.99


def test_delete_product(client, auth_headers, product, db_session):
    res = client.delete(f"/api/products/{product.id}", headers=auth_headers)
    assert res.status_code == 200
    assert db_session.get(Product, product.id) is None


def test_products_are_scoped_by_user(client, auth_headers, other_auth_headers, product):
    res = client.get("/api/products/", headers=other_auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert product.id not in {p["id"] for p in _items(body)}

    missing = client.delete(f"/api/products/{product.id}", headers=other_auth_headers)
    assert missing.status_code == 404


def test_delete_all_products(client, auth_headers, user, product, db_session):
    res = client.delete("/api/products/all", headers=auth_headers)
    assert res.status_code == 200
    assert db_session.query(Product).filter_by(user_id=user.id).count() == 0


def test_create_sold_by_weight_product(client, auth_headers):
    res = client.post(
        "/api/products/",
        headers=auth_headers,
        json={
            "name": "Banany",
            "package_weight": 1,
            "price": 6.99,
            "unit": "kg",
            "sold_by_weight": True,
        },
    )
    assert res.status_code == 201
    assert res.json()["sold_by_weight"] is True


def test_reject_invalid_price(client, auth_headers):
    res = client.post(
        "/api/products/",
        headers=auth_headers,
        json={"name": "Test", "package_weight": 100, "price": -1},
    )
    assert res.status_code == 400


def test_customize_system_product(client, auth_headers, global_catalog):
    listed = client.get("/api/products/", headers=auth_headers).json()
    items = _items(listed)
    system = next(p for p in items if p.get("source") == "system")
    res = client.post(
        f"/api/products/{system['id']}/customize",
        headers=auth_headers,
        json={"price": 4.99},
    )
    assert res.status_code == 200
    assert res.json()["price"] == 4.99
    assert res.json()["source"] == "user"
