from app.domain.product_normalize import normalize_product_name
from app.models.product import Product
from app.models.product_market_price import ProductMarketPrice
from app.models.product_translation import ProductTranslation
from app.scripts.import_catalog import import_catalog


def _items(body: dict) -> list:
    return body["items"]


def _add_user_product(db_session, user, name: str, *, market_code: str = "PL", price: float = 5.0):
    product = Product(
        user_id=user.id,
        source="user",
        user_name=name,
        normalized_name=normalize_product_name(name),
        kcal=0,
        protein=0,
        fat=0,
        carbs=0,
    )
    product.market_prices.append(
        ProductMarketPrice(
            market_code=market_code,
            amount=price,
            currency="PLN" if market_code == "PL" else "GBP",
            package_weight=250,
            unit="g",
            sold_by_weight=False,
        )
    )
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)
    return product


def test_list_includes_system_and_own_products(client, auth_headers, user, db_session):
    import_catalog(db_session)
    own = _add_user_product(db_session, user, "Moj prywatny produkt")

    res = client.get(
        "/api/products/",
        headers=auth_headers,
        params={"limit": 100, "q": "prywatny"},
    )
    assert res.status_code == 200
    body = res.json()
    items = _items(body)
    assert body["total"] >= 1
    sources = {p["name"]: p for p in items}
    assert "Moj prywatny produkt" in sources
    assert sources["Moj prywatny produkt"]["is_editable"] is True

    all_res = client.get("/api/products/", headers=auth_headers, params={"limit": 5})
    assert any(p["is_system"] for p in _items(all_res.json()))


def test_list_search_filters_by_normalized_name(client, auth_headers, db_session):
    import_catalog(db_session)
    res = client.get(
        "/api/products/",
        headers=auth_headers,
        params={"q": "jogurt", "limit": 100},
    )
    assert res.status_code == 200
    items = _items(res.json())
    assert len(items) >= 1
    assert all("jogurt" in p["name"].lower() for p in items)


def test_list_pagination(client, auth_headers, db_session):
    import_catalog(db_session)
    full = client.get("/api/products/", headers=auth_headers, params={"limit": 100})
    total = full.json()["total"]
    assert total >= 2

    page = client.get("/api/products/", headers=auth_headers, params={"limit": 1, "offset": 0})
    assert page.status_code == 200
    body = page.json()
    assert len(body["items"]) == 1
    assert body["limit"] == 1
    assert body["offset"] == 0
    assert body["total"] == total


def test_override_hides_system_product(client, auth_headers, user, db_session):
    report = import_catalog(db_session)
    assert report.products_created >= 1
    system = (
        db_session.query(Product)
        .filter_by(source="system")
        .filter(Product.user_id.is_(None))
        .first()
    )
    assert system is not None
    pl_name = next(t.name for t in system.translations if t.locale == "pl")

    override = Product(
        user_id=user.id,
        source="user",
        base_product_id=system.id,
        user_name=f"Override {pl_name}",
        normalized_name=system.normalized_name,
        kcal=system.kcal,
        protein=system.protein,
        fat=system.fat,
        carbs=system.carbs,
    )
    pl_price = next(p for p in system.market_prices if p.market_code == "PL")
    override.market_prices.append(
        ProductMarketPrice(
            market_code="PL",
            amount=9.99,
            currency="PLN",
            package_weight=pl_price.package_weight,
            unit=pl_price.unit,
            sold_by_weight=pl_price.sold_by_weight,
        )
    )
    db_session.add(override)
    db_session.commit()

    res = client.get(
        "/api/products/",
        headers=auth_headers,
        params={"limit": 100, "q": pl_name[:6]},
    )
    ids = {p["id"] for p in _items(res.json())}
    assert system.id not in ids
    assert override.id in ids


def test_recipe_can_use_system_product(client, auth_headers, db_session):
    import_catalog(db_session)
    system = (
        db_session.query(Product)
        .filter_by(source="system")
        .filter(Product.user_id.is_(None))
        .first()
    )
    assert system is not None

    res = client.post(
        "/api/recipes/",
        headers=auth_headers,
        json={
            "name": "Z systemowym",
            "category": "lunch",
            "servings": 1,
            "ingredients": [{"product_id": system.id, "weight": 100}],
        },
    )
    assert res.status_code == 201


def test_other_user_cannot_resolve_private_product_in_recipe(
    client, auth_headers, other_auth_headers, product
):
    res = client.post(
        "/api/recipes/",
        headers=other_auth_headers,
        json={
            "name": "Cudzy",
            "category": "lunch",
            "servings": 1,
            "ingredients": [{"product_id": product.id, "weight": 50}],
        },
    )
    assert res.status_code == 404


def test_list_rejects_invalid_limit(client, auth_headers):
    res = client.get("/api/products/", headers=auth_headers, params={"limit": 0})
    assert res.status_code == 400

    res = client.get("/api/products/", headers=auth_headers, params={"limit": 500})
    assert res.status_code == 400


def test_system_product_presenter_flags(client, auth_headers, db_session):
    import_catalog(db_session)
    res = client.get("/api/products/", headers=auth_headers, params={"limit": 100})
    system_rows = [p for p in _items(res.json()) if p["is_system"]]
    assert system_rows
    row = system_rows[0]
    assert row["source"] == "system"
    assert row["is_editable"] is False
    assert row["base_product_id"] is None
    assert row["catalog_key"]
    assert row["currency"] in ("PLN", "GBP")
