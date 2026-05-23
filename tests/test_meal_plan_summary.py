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
    data = res.get_json()
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
    assert "Copied 1 meals" in copied.get_json()["message"]

    target_day = client.get("/api/meal-plan/2026-06-08", headers=auth_headers)
    assert target_day.status_code == 200
    assert len(target_day.get_json()) == 1


def test_summary_rejects_invalid_dates(client, auth_headers):
    res = client.get(
        "/api/meal-plan/summary/not-a-date/2026-05-23",
        headers=auth_headers,
    )
    assert res.status_code == 400
