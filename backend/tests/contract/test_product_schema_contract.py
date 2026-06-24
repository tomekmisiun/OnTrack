def test_create_product_ignores_system_fields(client, auth_headers):
    res = client.post(
        "/api/products/",
        headers=auth_headers,
        json={
            "name": "Test",
            "package_weight": 100,
            "price": 1.0,
            "user_id": 999,
            "source": "system",
            "catalog_key": "evil:key",
        },
    )
    assert res.status_code == 201
    assert res.json()["name"] == "Test"
