def test_nutrition_lookup_demo_yogurt(client, auth_headers):
    res = client.get(
        "/api/nutrition/lookup",
        headers=auth_headers,
        params={"name": "jogurt naturalny", "lang": "pl"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["found"] is True
    assert data["source"] in ("database", "catalog")
    assert data["kcal"] > 0


def test_nutrition_lookup_missing_name(client, auth_headers):
    res = client.get("/api/nutrition/lookup", headers=auth_headers)
    assert res.status_code == 400


def test_nutrition_lookup_catalog_mleko(client, auth_headers, monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    res = client.get(
        "/api/nutrition/lookup",
        headers=auth_headers,
        params={"name": "mleko", "lang": "pl"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["found"] is True
    assert data["source"] in ("database", "catalog")
    assert data["kcal"] > 0


def test_nutrition_lookup_catalog_fuzzy_banany(client, auth_headers, monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    res = client.get(
        "/api/nutrition/lookup",
        headers=auth_headers,
        params={"name": "banany", "lang": "pl"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["found"] is True
    assert data["source"] in ("database", "catalog")


def test_openai_dependency_is_installed():
    import openai

    assert openai.__version__


def test_nutrition_lookup_unknown_without_ai(client, auth_headers, monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    res = client.get(
        "/api/nutrition/lookup",
        headers=auth_headers,
        params={"name": "xyztotallyunknowningredient999", "lang": "pl"},
    )
    assert res.status_code == 404
    data = res.json()
    assert data["found"] is False
