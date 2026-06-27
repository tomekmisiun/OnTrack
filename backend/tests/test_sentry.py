"""Tests for optional Sentry bootstrap."""

from app.core.config import Settings
from app.core.sentry import init_sentry


def test_init_sentry_noop_without_dsn():
    init_sentry(Settings(sentry_dsn=None))


def test_create_app_with_sentry_dsn(monkeypatch):
    monkeypatch.setenv("SENTRY_DSN", "https://example@sentry.io/1")
    monkeypatch.setenv("SENTRY_ENVIRONMENT", "test")
    monkeypatch.setenv("TESTING", "1")
    from app.core.config import get_settings

    get_settings.cache_clear()
    from app.main import create_app

    app = create_app()
    assert app.title == "OnTrack API"
    get_settings.cache_clear()
