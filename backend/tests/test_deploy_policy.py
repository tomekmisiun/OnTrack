"""Deployment config policy guards (DATA-006)."""

from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

LEGACY_DEPLOY_PATHS = (
    REPO_ROOT / "railway.toml",
    REPO_ROOT / "backend" / "Dockerfile.railway",
    REPO_ROOT / "backend" / "railway.prod.toml",
)

BACKEND_RAILWAY_TOML = REPO_ROOT / "backend" / "railway.toml"
BACKEND_DOCKERFILE = REPO_ROOT / "backend" / "Dockerfile"
MIGRATIONS_SCRIPT = REPO_ROOT / "backend" / "scripts" / "run-migrations.sh"


def test_legacy_deploy_files_removed():
    present = [str(p.relative_to(REPO_ROOT)) for p in LEGACY_DEPLOY_PATHS if p.exists()]
    assert not present, f"legacy deploy files still exist: {present}"


def test_canonical_railway_api_config_exists():
    assert BACKEND_RAILWAY_TOML.is_file()
    text = BACKEND_RAILWAY_TOML.read_text(encoding="utf-8")
    assert 'dockerfilePath = "Dockerfile"' in text
    assert "Dockerfile.railway" not in text


def test_railway_uses_pre_deploy_migrations_not_release_command():
    text = BACKEND_RAILWAY_TOML.read_text(encoding="utf-8")
    assert "releaseCommand" not in text, (
        "releaseCommand is not in Railway schema; use [deploy].preDeployCommand"
    )
    assert 'preDeployCommand = "sh scripts/run-migrations.sh"' in text


def test_railway_pre_deploy_command_targets_existing_script():
    assert MIGRATIONS_SCRIPT.is_file()
    match = re.search(
        r'preDeployCommand\s*=\s*"([^"]+)"',
        BACKEND_RAILWAY_TOML.read_text(encoding="utf-8"),
    )
    assert match, "preDeployCommand missing from backend/railway.toml"
    command = match.group(1)
    script_path = command.removeprefix("sh ").strip()
    assert (REPO_ROOT / "backend" / script_path).is_file(), (
        f"preDeployCommand references missing script: {script_path}"
    )


def test_production_dockerfile_includes_alembic_and_migration_script():
    dockerfile = BACKEND_DOCKERFILE.read_text(encoding="utf-8")
    assert "COPY alembic ./alembic" in dockerfile
    assert "COPY alembic.ini ./" in dockerfile
    assert "COPY scripts ./scripts" in dockerfile
    assert MIGRATIONS_SCRIPT.is_file()
    assert (REPO_ROOT / "backend" / "scripts" / "ensure_alembic_head.py").is_file()


def test_railway_watch_patterns_include_alembic():
    text = BACKEND_RAILWAY_TOML.read_text(encoding="utf-8")
    assert '"alembic/**"' in text
