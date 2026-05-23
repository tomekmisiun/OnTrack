def test_delete_meal_forbidden_for_other_user(client, auth_headers, other_auth_headers, recipe, member):
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
    meal_id = created.get_json()["id"]

    denied = client.delete(f"/api/meal-plan/{meal_id}", headers=other_auth_headers)
    assert denied.status_code == 403
