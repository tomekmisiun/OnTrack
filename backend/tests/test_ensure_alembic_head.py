"""Tests for deploy-time Alembic adoption (legacy Flask revision ids)."""

from __future__ import annotations

from scripts.ensure_alembic_head import _fastapi_revisions


def test_fastapi_revisions_includes_known_heads():
    revisions = _fastapi_revisions()
    assert "7966d120d748" in revisions
    assert "f1a2b3c4d5e6" in revisions
    assert "a1b2c3d4e5f6" not in revisions
