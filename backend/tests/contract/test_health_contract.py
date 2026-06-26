def test_health_ok(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_health_ready_ok(client):
    res = client.get("/health/ready")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "database": "ok"}


def test_metrics_ok(client):
    res = client.get("/metrics")
    assert res.status_code == 200
    assert "ontrack_up 1" in res.text
