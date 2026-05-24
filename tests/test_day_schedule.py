def test_create_and_list_schedule_blocks(client, auth_headers, member):
    res = client.post(
        "/api/day-schedule/",
        headers=auth_headers,
        json={
            "day": 0,
            "start_hour": 9,
            "end_hour": 12,
            "label": "Praca",
            "member_id": member.id,
        },
    )
    assert res.status_code == 201
    block = res.get_json()
    assert block["label"] == "Praca"
    assert block["start_hour"] == 9
    assert block["end_hour"] == 12

    listed = client.get(f"/api/day-schedule/?member_id={member.id}", headers=auth_headers)
    assert listed.status_code == 200
    items = listed.get_json()
    assert len(items) == 1
    assert items[0]["id"] == block["id"]


def test_schedule_rejects_overlap(client, auth_headers, member):
    payload = {
        "day": 1,
        "start_hour": 14,
        "end_hour": 16,
        "label": "Spotkanie",
        "member_id": member.id,
    }
    first = client.post("/api/day-schedule/", headers=auth_headers, json=payload)
    assert first.status_code == 201

    overlap = client.post(
        "/api/day-schedule/",
        headers=auth_headers,
        json={**payload, "start_hour": 15, "end_hour": 17, "label": "Inne"},
    )
    assert overlap.status_code == 409


def test_delete_schedule_block(client, auth_headers, member):
    created = client.post(
        "/api/day-schedule/",
        headers=auth_headers,
        json={
            "day": 3,
            "start_hour": 18,
            "end_hour": 20,
            "label": "Siłownia",
            "member_id": member.id,
        },
    )
    block_id = created.get_json()["id"]

    deleted = client.delete(f"/api/day-schedule/{block_id}", headers=auth_headers)
    assert deleted.status_code == 200

    listed = client.get(f"/api/day-schedule/?member_id={member.id}", headers=auth_headers)
    assert listed.get_json() == []
