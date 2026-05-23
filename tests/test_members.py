def test_list_members(client, auth_headers, member):
    res = client.get("/api/members/", headers=auth_headers)
    assert res.status_code == 200
    data = res.get_json()
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
    mid = created.get_json()["id"]

    renamed = client.patch(
        f"/api/members/{mid}",
        headers=auth_headers,
        json={"name": "Tomek"},
    )
    assert renamed.status_code == 200
    assert renamed.get_json()["name"] == "Tomek"


def test_cannot_delete_primary_member(client, auth_headers, member):
    res = client.delete(f"/api/members/{member.id}", headers=auth_headers)
    assert res.status_code == 403
