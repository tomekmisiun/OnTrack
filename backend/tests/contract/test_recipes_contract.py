from app.models.recipe import Recipe


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
    recipe_id = res.json()["id"]

    detail = client.get(f"/api/recipes/{recipe_id}", headers=auth_headers)
    assert detail.status_code == 200
    data = detail.json()
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
    assert res.json()["is_favorite"] is True

    again = client.patch(f"/api/recipes/{recipe.id}/favorite", headers=auth_headers)
    assert again.json()["is_favorite"] is False


def test_delete_recipe(client, auth_headers, recipe):
    res = client.delete(f"/api/recipes/{recipe.id}", headers=auth_headers)
    assert res.status_code == 200
    assert client.get(f"/api/recipes/{recipe.id}", headers=auth_headers).status_code == 404


def test_update_category(client, auth_headers, recipe):
    res = client.patch(
        f"/api/recipes/{recipe.id}/category",
        headers=auth_headers,
        json={"category": "dinner"},
    )
    assert res.status_code == 200
    assert res.json()["category"] == "dinner"


def test_update_recipe(client, auth_headers, recipe, product):
    res = client.put(
        f"/api/recipes/{recipe.id}",
        headers=auth_headers,
        json={
            "name": "Owsianka XL",
            "ingredients": [{"product_id": product.id, "weight": 300}],
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Owsianka XL"
    assert data["ingredients"][0]["weight"] == 300


def test_fetch_recipe_image(client, auth_headers, recipe, monkeypatch):
    monkeypatch.setattr(
        "app.services.recipe_service.resolve_recipe_image",
        lambda _recipe: "https://example.com/photo.jpg",
    )
    res = client.post(f"/api/recipes/{recipe.id}/fetch-image", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["image_url"] == "https://example.com/photo.jpg"


def test_delete_all_recipes(client, auth_headers, recipe, db_session):
    res = client.delete("/api/recipes/all", headers=auth_headers)
    assert res.status_code == 200
    assert db_session.query(Recipe).filter_by(user_id=recipe.user_id).count() == 0
