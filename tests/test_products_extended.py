from app.models.product import Product


def test_delete_all_products(client, auth_headers, user, product):
    uid = user.id
    res = client.delete("/api/products/all", headers=auth_headers)
    assert res.status_code == 200
    assert Product.query.filter_by(user_id=uid).count() == 0


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
    assert res.get_json()["sold_by_weight"] is True


def test_reject_invalid_price(client, auth_headers):
    res = client.post(
        "/api/products/",
        headers=auth_headers,
        json={"name": "Test", "package_weight": 100, "price": -1},
    )
    assert res.status_code == 400
