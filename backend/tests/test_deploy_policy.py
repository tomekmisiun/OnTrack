"""Deployment config policy guards (DATA-006)."""

from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

LEGACY_DEPLOY_PATHS = (
    REPO_ROOT / "railway.toml",
    REPO_ROOT / "backend" / "Dockerfile.railway",
    REPO_ROOT / "backend" / "railway.prod.toml",
)


def test_legacy_deploy_files_removed():
    present = [str(p.relative_to(REPO_ROOT)) for p in LEGACY_DEPLOY_PATHS if p.exists()]
    assert not present, f"legacy deploy files still exist: {present}"


def test_canonical_railway_api_config_exists():
    config = REPO_ROOT / "backend" / "railway.toml"
    assert config.is_file()
    text = config.read_text(encoding="utf-8")
    assert 'dockerfilePath = "Dockerfile"' in text
    assert "Dockerfile.railway" not in text
