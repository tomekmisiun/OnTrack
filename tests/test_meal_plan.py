def test_add_meal_and_get_day(client, auth_headers, recipe, member):
    res = client.post(
        "/api/meal-plan/",
        headers=auth_headers,
        json={
            "date": "2026-05-23",
            "position": 1,
            "recipe_id": recipe.id,
            "member_id": member.id,
        },
    )
    assert res.status_code == 201
    meal_id = res.get_json()["id"]

    day = client.get("/api/meal-plan/2026-05-23", headers=auth_headers)
    assert day.status_code == 200
    meals = day.get_json()
    assert len(meals) == 1
    assert meals[0]["recipe"]["name"] == recipe.name

    deleted = client.delete(f"/api/meal-plan/{meal_id}", headers=auth_headers)
    assert deleted.status_code == 200


def test_add_meal_replaces_existing_slot(client, auth_headers, recipe, member):
    payload = {
        "date": "2026-05-24",
        "position": 2,
        "recipe_id": recipe.id,
        "member_id": member.id,
    }
    first = client.post("/api/meal-plan/", headers=auth_headers, json=payload)
    assert first.status_code == 201
    meal_id = first.get_json()["id"]

    second = client.post("/api/meal-plan/", headers=auth_headers, json=payload)
    assert second.status_code == 200
    assert second.get_json()["id"] == meal_id
    assert second.get_json()["recipe"]["id"] == recipe.id


def test_meal_plan_range(client, auth_headers, recipe, member):
    client.post(
        "/api/meal-plan/",
        headers=auth_headers,
        json={
            "date": "2026-05-25",
            "position": 1,
            "recipe_id": recipe.id,
            "member_id": member.id,
        },
    )
    res = client.get(
        "/api/meal-plan/range/2026-05-25/2026-05-25",
        headers=auth_headers,
    )
    assert res.status_code == 200
    data = res.get_json()
    assert "2026-05-25" in data
    assert len(data["2026-05-25"]) == 1
    meal = data["2026-05-25"][0]
    assert meal["recipe"]["name"] == recipe.name
    assert meal["recipe"]["ingredients"] == []
