def test_nutrition_lookup_schab(client, auth_headers):
    res = client.get(
        '/api/nutrition/lookup',
        headers=auth_headers,
        query_string={'name': 'schab', 'lang': 'pl'},
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data['found'] is True
    assert data['source'] == 'database'
    assert data['kcal'] == 242.0


def test_nutrition_lookup_missing_name(client, auth_headers):
    res = client.get('/api/nutrition/lookup', headers=auth_headers)
    assert res.status_code == 400


def test_nutrition_lookup_unknown_without_ai(client, auth_headers, monkeypatch):
    monkeypatch.delenv('DEEPSEEK_API_KEY', raising=False)
    res = client.get(
        '/api/nutrition/lookup',
        headers=auth_headers,
        query_string={'name': 'xyztotallyunknowningredient999', 'lang': 'pl'},
    )
    assert res.status_code == 404
    data = res.get_json()
    assert data['found'] is False
