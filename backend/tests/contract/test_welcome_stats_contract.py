"""Contract tests for own-only catalog counts used on the welcome screen."""


def test_list_own_products_returns_only_user_products(
    client, auth_headers, other_auth_headers, product, global_catalog
):
    res = client.get("/api/products/", headers=auth_headers, params={"own_only": True})
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert len(body["items"]) == 1
    assert body["items"][0]["id"] == product.id
    assert all(item["is_editable"] for item in body["items"])

    other = client.get("/api/products/", headers=other_auth_headers, params={"own_only": True})
    assert other.status_code == 200
    assert other.json()["total"] == 0


def test_list_own_recipes_returns_only_user_recipes(client, auth_headers, recipe, global_catalog):
    res = client.get("/api/recipes/", headers=auth_headers, params={"own_only": True})
    assert res.status_code == 200
    body = res.json()
    assert isinstance(body, list)
    assert len(body) == 1
    assert body[0]["id"] == recipe.id

    catalog = client.get("/api/recipes/", headers=auth_headers)
    assert catalog.status_code == 200
    assert len(catalog.json()) > len(body)
