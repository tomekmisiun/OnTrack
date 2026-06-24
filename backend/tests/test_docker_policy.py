"""Docker image policy guards."""

from __future__ import annotations

from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
DOCKERFILE = BACKEND_ROOT / "Dockerfile"

FORBIDDEN_DOCKERFILE_SUBSTRINGS = (
    "COPY scraper",
    "COPY app/user_seeds",
    "COPY app/dish_compare",
    "COPY ../",
)


def test_backend_dockerfile_is_self_contained():
    source = DOCKERFILE.read_text(encoding="utf-8")
    for needle in FORBIDDEN_DOCKERFILE_SUBSTRINGS:
        assert needle not in source, f"backend/Dockerfile must not contain {needle!r}"
    assert "COPY data ./data" in source
    assert "scripts/start-production.sh" in source


def test_dockerfile_railway_removed():
    assert not (BACKEND_ROOT / "Dockerfile.railway").exists()
