from app.models.product import Product
from app.models.recipe import Recipe, RecipeIngredient
from app.scripts.import_catalog import import_catalog


def _system_product(db_session) -> Product:
    import_catalog(db_session, markets=("PL",))
    system = (
        db_session.query(Product)
        .filter_by(source="system", market_code="PL")
        .filter(Product.user_id.is_(None))
        .first()
    )
    assert system is not None
    return system


def test_cannot_put_system_product(client, auth_headers, db_session):
    system = _system_product(db_session)
    res = client.put(
        f"/api/products/{system.id}",
        headers=auth_headers,
        json={"price": 1.0},
    )
    assert res.status_code == 403
    assert "cannot be modified" in res.json()["error"].lower()


def test_cannot_delete_system_product(client, auth_headers, db_session):
    system = _system_product(db_session)
    res = client.delete(f"/api/products/{system.id}", headers=auth_headers)
    assert res.status_code == 403


def test_customize_system_product_creates_private_override(client, auth_headers, db_session):
    system = _system_product(db_session)
    res = client.post(
        f"/api/products/{system.id}/customize",
        headers=auth_headers,
        json={"price": 7.77},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["price"] == 7.77
    assert body["base_product_id"] == system.id
    assert body["is_editable"] is True
    assert body["is_system"] is False

    listed = client.get(
        "/api/products/",
        headers=auth_headers,
        params={"limit": 100, "q": system.name[:6]},
    )
    ids = {p["id"] for p in listed.json()["items"]}
    assert system.id not in ids
    assert body["id"] in ids


def test_customize_again_updates_existing_override(client, auth_headers, db_session):
    system = _system_product(db_session)
    first = client.post(
        f"/api/products/{system.id}/customize",
        headers=auth_headers,
        json={"price": 5.0},
    )
    second = client.post(
        f"/api/products/{system.id}/customize",
        headers=auth_headers,
        json={"price": 6.0},
    )
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    assert second.json()["price"] == 6.0


def test_delete_product_used_in_recipe_returns_409(
    client, auth_headers, user, product, db_session
):
    recipe = Recipe(name="Uses product", user_id=user.id, category="lunch", lang="pl", servings=1)
    db_session.add(recipe)
    db_session.flush()
    db_session.add(RecipeIngredient(recipe_id=recipe.id, product_id=product.id, weight=100))
    db_session.commit()

    res = client.delete(f"/api/products/{product.id}", headers=auth_headers)
    assert res.status_code == 409
    assert "recipes" in res.json()["error"].lower()
    assert db_session.get(Product, product.id) is not None


def test_delete_unused_private_product_succeeds(client, auth_headers, product, db_session):
    res = client.delete(f"/api/products/{product.id}", headers=auth_headers)
    assert res.status_code == 200
    assert db_session.get(Product, product.id) is None


def test_other_user_still_gets_404_on_private_product_mutations(
    client, other_auth_headers, product
):
    put = client.put(
        f"/api/products/{product.id}",
        headers=other_auth_headers,
        json={"price": 1.0},
    )
    delete = client.delete(f"/api/products/{product.id}", headers=other_auth_headers)
    assert put.status_code == 404
    assert delete.status_code == 404
