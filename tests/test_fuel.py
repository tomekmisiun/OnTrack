def test_fuel_prices_pl(client, monkeypatch):
    from app.routes import fuel as fuel_mod

    fuel_mod._cache_pl["data"] = None
    fuel_mod._cache_pl["ts"] = 0
    monkeypatch.setattr(
        fuel_mod,
        "_fetch_pl",
        lambda: {"benzyna": 6.12, "diesel": 6.45, "gaz": 2.99},
    )

    res = client.get("/api/fuel/prices?lang=pl")
    assert res.status_code == 200
    data = res.get_json()
    assert data["benzyna"] == 6.12
    assert data["diesel"] == 6.45


def test_fuel_prices_uses_cache(client, monkeypatch):
    from app.routes import fuel as fuel_mod

    fuel_mod._cache_pl["data"] = None
    fuel_mod._cache_pl["ts"] = 0
    calls = {"n": 0}

    def counted_fetch():
        calls["n"] += 1
        return {"benzyna": 6.0, "diesel": 6.1}

    monkeypatch.setattr(fuel_mod, "_fetch_pl", counted_fetch)

    first = client.get("/api/fuel/prices?lang=pl")
    second = client.get("/api/fuel/prices?lang=pl")
    assert first.status_code == 200
    assert second.status_code == 200
    assert calls["n"] == 1
