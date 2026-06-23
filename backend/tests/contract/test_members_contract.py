def test_list_members(client, auth_headers, member):
    res = client.get("/api/members/", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["name"] == "Ja"
    assert data[0]["is_primary"] is True


def test_create_and_rename_member(client, auth_headers):
    created = client.post(
        "/api/members/",
        headers=auth_headers,
        json={"name": "Partner"},
    )
    assert created.status_code == 201
    mid = created.json()["id"]

    renamed = client.patch(
        f"/api/members/{mid}",
        headers=auth_headers,
        json={"name": "Tomek"},
    )
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Tomek"


def test_cannot_delete_primary_member(client, auth_headers, member):
    res = client.delete(f"/api/members/{member.id}", headers=auth_headers)
    assert res.status_code == 403


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
    data = res.json()
    assert data["age"] == 30
    assert data["macro_goals"]["kcal"] == 2500
    assert data["macro_goals"]["goalLabel"] == "Utrzymanie"


def test_delete_secondary_member(client, auth_headers):
    created = client.post(
        "/api/members/",
        headers=auth_headers,
        json={"name": "Dziecko"},
    )
    mid = created.json()["id"]

    deleted = client.delete(f"/api/members/{mid}", headers=auth_headers)
    assert deleted.status_code == 200
    assert deleted.json()["message"] == "Deleted"
