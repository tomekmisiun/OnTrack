def test_import_parse_free_requires_auth(client):
    res = client.post("/api/import/parse-free")
    assert res.status_code == 401


def test_nutrition_lookup_requires_name(client, auth_headers):
    res = client.get("/api/nutrition/lookup", headers=auth_headers)
    assert res.status_code == 400
