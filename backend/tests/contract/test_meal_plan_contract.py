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
    meal_id = res.json()["id"]

    day = client.get("/api/meal-plan/2026-05-23", headers=auth_headers)
    assert day.status_code == 200
    meals = day.json()
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
    meal_id = first.json()["id"]

    second = client.post("/api/meal-plan/", headers=auth_headers, json=payload)
    assert second.status_code == 200
    assert second.json()["id"] == meal_id
    assert second.json()["recipe"]["id"] == recipe.id


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
    data = res.json()
    assert "2026-05-25" in data
    assert len(data["2026-05-25"]) == 1
    meal = data["2026-05-25"][0]
    assert meal["recipe"]["name"] == recipe.name
    assert meal["recipe"]["ingredients"] == []


def test_summary_totals_shopping_cost(client, auth_headers, recipe, member):
    client.post(
        "/api/meal-plan/",
        headers=auth_headers,
        json={
            "date": "2026-05-23",
            "position": 1,
            "recipe_id": recipe.id,
            "member_id": member.id,
        },
    )

    res = client.get(
        "/api/meal-plan/summary/2026-05-23/2026-05-23",
        headers=auth_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["product_name"] == "Jogurt naturalny"
    assert data["items"][0]["total_weight"] == 200
    assert data["total_cost"] > 0


def test_copy_range_duplicates_meals(client, auth_headers, recipe, member):
    client.post(
        "/api/meal-plan/",
        headers=auth_headers,
        json={
            "date": "2026-06-01",
            "position": 1,
            "recipe_id": recipe.id,
            "member_id": member.id,
        },
    )

    copied = client.post(
        "/api/meal-plan/copy",
        headers=auth_headers,
        json={
            "source_start": "2026-06-01",
            "source_end": "2026-06-01",
            "target_start": "2026-06-08",
            "member_id": member.id,
        },
    )
    assert copied.status_code == 201
    assert "Copied 1 meals" in copied.json()["message"]

    target_day = client.get("/api/meal-plan/2026-06-08", headers=auth_headers)
    assert target_day.status_code == 200
    assert len(target_day.json()) == 1


def test_summary_rejects_invalid_dates(client, auth_headers):
    res = client.get(
        "/api/meal-plan/summary/not-a-date/2026-05-23",
        headers=auth_headers,
    )
    assert res.status_code == 400


def test_delete_meal_forbidden_for_other_user(
    client, auth_headers, other_auth_headers, recipe, member
):
    created = client.post(
        "/api/meal-plan/",
        headers=auth_headers,
        json={
            "date": "2026-07-01",
            "position": 1,
            "recipe_id": recipe.id,
            "member_id": member.id,
        },
    )
    meal_id = created.json()["id"]

    denied = client.delete(f"/api/meal-plan/{meal_id}", headers=other_auth_headers)
    assert denied.status_code == 403
