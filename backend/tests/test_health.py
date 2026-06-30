from app.main import app
from fastapi.testclient import TestClient


def test_health_ok() -> None:
    client = TestClient(app)
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert isinstance(data.get("google_oauth"), bool)
