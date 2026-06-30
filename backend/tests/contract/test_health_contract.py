def test_health_ok(client):
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert isinstance(data.get("google_oauth"), bool)


def test_health_ready_ok(client):
    res = client.get("/health/ready")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "database": "ok"}


def test_metrics_ok(client):
    client.get("/health")
    res = client.get("/metrics")
    assert res.status_code == 200
    assert "ontrack_up 1" in res.text
    assert "ontrack_http_requests_total" in res.text
