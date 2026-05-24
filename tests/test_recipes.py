def test_recipes_require_auth(client):
    assert client.get("/api/recipes/").status_code == 401


def test_create_and_get_recipe(client, auth_headers, product):
    res = client.post(
        "/api/recipes/",
        headers=auth_headers,
        json={
            "name": "Kanapka",
            "category": "lunch",
            "servings": 4,
            "ingredients": [{"product_id": product.id, "weight": 400}],
        },
    )
    assert res.status_code == 201
    recipe_id = res.get_json()["id"]

    detail = client.get(f"/api/recipes/{recipe_id}", headers=auth_headers)
    assert detail.status_code == 200
    data = detail.get_json()
    assert data["name"] == "Kanapka"
    assert data["servings"] == 4
    assert len(data["ingredients"]) == 1
    assert data["ingredients"][0]["weight"] == 100


def test_create_recipe_requires_servings(client, auth_headers, product):
    res = client.post(
        "/api/recipes/",
        headers=auth_headers,
        json={
            "name": "Bez porcji",
            "ingredients": [{"product_id": product.id, "weight": 100}],
        },
    )
    assert res.status_code == 400


def test_create_recipe_requires_valid_ingredient(client, auth_headers):
    res = client.post(
        "/api/recipes/",
        headers=auth_headers,
        json={"name": "Pusta", "servings": 2, "ingredients": [{"product_id": 9999, "weight": 50}]},
    )
    assert res.status_code == 404


def test_toggle_favorite(client, auth_headers, recipe):
    res = client.patch(f"/api/recipes/{recipe.id}/favorite", headers=auth_headers)
    assert res.status_code == 200
    assert res.get_json()["is_favorite"] is True

    again = client.patch(f"/api/recipes/{recipe.id}/favorite", headers=auth_headers)
    assert again.get_json()["is_favorite"] is False


def test_delete_recipe(client, auth_headers, recipe):
    res = client.delete(f"/api/recipes/{recipe.id}", headers=auth_headers)
    assert res.status_code == 200
    assert client.get(f"/api/recipes/{recipe.id}", headers=auth_headers).status_code == 404
