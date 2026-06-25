from app.core.cors import cors_allowed_origins


def test_cors_origins_production_exact():
    origins = cors_allowed_origins(
        "https://app.example.com",
        debug=False,
        testing=False,
    )
    assert origins == ["https://app.example.com"]


def test_cors_origins_debug_adds_loopback_peer():
    origins = cors_allowed_origins(
        "http://localhost:3000,http://localhost:3002",
        debug=True,
        testing=False,
    )
    assert "http://localhost:3000" in origins
    assert "http://127.0.0.1:3000" in origins
    assert "http://localhost:3002" in origins
    assert "http://127.0.0.1:3002" in origins
    assert len(origins) == 4


def test_cors_origins_testing_adds_peer():
    origins = cors_allowed_origins(
        "http://127.0.0.1:3002",
        debug=False,
        testing=True,
    )
    assert origins == ["http://127.0.0.1:3002", "http://localhost:3002"]
