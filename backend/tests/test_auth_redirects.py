"""OAuth redirect URL helpers."""

from app.services import auth_service


def test_auth_error_redirect_uses_first_frontend_origin(monkeypatch):
    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(
        settings,
        "frontend_url",
        "http://localhost:3000,http://127.0.0.1:3000",
        raising=False,
    )
    url = auth_service.auth_error_redirect("oauth_failed")
    assert url == "http://localhost:3000/login?auth_error=oauth_failed"


def test_oauth_success_redirect_uses_first_frontend_origin(monkeypatch):
    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(
        settings,
        "frontend_url",
        "https://app.example.com,https://www.example.com",
        raising=False,
    )
    url = auth_service.oauth_success_redirect("abc123")
    assert url.startswith("https://app.example.com/?")
    assert "code=abc123" in url
