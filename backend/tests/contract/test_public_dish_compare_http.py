def test_public_dish_compare_pl(client):
    res = client.get("/api/public/dish-compare?lang=pl")
    assert res.status_code == 200
    data = res.json()
    assert data["currency"] == "PLN"
    assert len(data["dishes"]) == 5
    assert data["default_delivery_price"] == 6.0
    assert "meal_prep" in data
    spaghetti = next(d for d in data["dishes"] if d["id"] == "spaghetti_bolognese")
    assert spaghetti["name"]
    assert "defaults" in spaghetti


def test_public_dish_compare_en(client):
    res = client.get("/api/public/dish-compare?lang=en")
    assert res.status_code == 200
    data = res.json()
    assert data["currency"] == "GBP"
    assert len(data["dishes"]) == 5
    assert next(d for d in data["dishes"] if d["id"] == "chicken_chow_mein")
