def test_save_member_profile(client, auth_headers, member):
    res = client.patch(
        f"/api/members/{member.id}/profile",
        headers=auth_headers,
        json={
            "gender": "m",
            "age": 30,
            "weight": 80,
            "height": 180,
            "activity": 1.4,
            "goal": "maintain",
            "macro_kcal": 2500,
            "macro_protein": 160,
            "macro_fat": 70,
            "macro_carbs": 280,
            "macro_goal_label": "Utrzymanie",
        },
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data["age"] == 30
    assert data["macro_goals"]["kcal"] == 2500


def test_delete_secondary_member(client, auth_headers):
    created = client.post(
        "/api/members/",
        headers=auth_headers,
        json={"name": "Dziecko"},
    )
    mid = created.get_json()["id"]

    deleted = client.delete(f"/api/members/{mid}", headers=auth_headers)
    assert deleted.status_code == 200
