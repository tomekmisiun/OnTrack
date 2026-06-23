WEEK_START = "2026-05-18"  # Monday


def test_create_and_list_schedule_blocks(client, auth_headers, member):
    res = client.post(
        "/api/day-schedule/",
        headers=auth_headers,
        json={
            "week_start": WEEK_START,
            "day": 0,
            "start_hour": 9,
            "end_hour": 12,
            "label": "Praca",
            "member_id": member.id,
        },
    )
    assert res.status_code == 201
    block = res.json()
    assert block["label"] == "Praca"
    assert block["week_start"] == WEEK_START

    listed = client.get(
        f"/api/day-schedule/?member_id={member.id}&week_start={WEEK_START}",
        headers=auth_headers,
    )
    assert listed.status_code == 200
    items = listed.json()
    assert len(items) == 1
    assert items[0]["id"] == block["id"]


def test_schedule_rejects_overlap(client, auth_headers, member):
    payload = {
        "week_start": WEEK_START,
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
            "week_start": WEEK_START,
            "day": 3,
            "start_hour": 18,
            "end_hour": 20,
            "label": "Siłownia",
            "member_id": member.id,
        },
    )
    block_id = created.json()["id"]

    deleted = client.delete(f"/api/day-schedule/{block_id}", headers=auth_headers)
    assert deleted.status_code == 200

    listed = client.get(
        f"/api/day-schedule/?member_id={member.id}&week_start={WEEK_START}",
        headers=auth_headers,
    )
    assert listed.json() == []


def test_bulk_work_hours(client, auth_headers, member):
    res = client.post(
        "/api/day-schedule/bulk",
        headers=auth_headers,
        json={
            "week_start": WEEK_START,
            "start_hour": 9,
            "end_hour": 17,
            "label": "Praca",
            "days": [0, 1, 2, 3, 4],
            "member_id": member.id,
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert len(data["created"]) == 5
    assert data["skipped"] == []

    listed = client.get(
        f"/api/day-schedule/?member_id={member.id}&week_start={WEEK_START}",
        headers=auth_headers,
    )
    assert len(listed.json()) == 5


def test_bulk_skips_overlapping_days(client, auth_headers, member):
    client.post(
        "/api/day-schedule/",
        headers=auth_headers,
        json={
            "week_start": WEEK_START,
            "day": 0,
            "start_hour": 9,
            "end_hour": 17,
            "label": "Praca",
            "member_id": member.id,
        },
    )
    res = client.post(
        "/api/day-schedule/bulk",
        headers=auth_headers,
        json={
            "week_start": WEEK_START,
            "start_hour": 9,
            "end_hour": 17,
            "label": "Praca",
            "days": [0, 1],
            "member_id": member.id,
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert len(data["created"]) == 1
    assert data["skipped"] == [0]
