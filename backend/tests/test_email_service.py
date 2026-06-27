"""Tests for email delivery helpers."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from app.services import email_service


def test_is_deliverable_email():
    assert email_service.is_deliverable_email("user@example.com")
    assert not email_service.is_deliverable_email("user@users.ontrack.local")
    assert not email_service.is_deliverable_email(None)


def test_password_reset_url(monkeypatch):
    monkeypatch.setenv("FRONTEND_URL", "https://app.example.com")
    from app.core.config import get_settings

    get_settings.cache_clear()
    url = email_service.password_reset_url("abc123")
    assert url == "https://app.example.com/login?reset_token=abc123"


@patch("app.services.email_service.smtplib.SMTP")
def test_send_email_uses_smtp(mock_smtp_class, monkeypatch):
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_FROM", "noreply@example.com")
    monkeypatch.setenv("SMTP_USER", "user")
    monkeypatch.setenv("SMTP_PASSWORD", "pass")
    from app.core.config import get_settings

    get_settings.cache_clear()

    smtp = MagicMock()
    mock_smtp_class.return_value.__enter__.return_value = smtp

    email_service.send_email(
        to="user@example.com",
        subject="Test",
        body_text="Hello",
    )

    smtp.starttls.assert_called_once()
    smtp.login.assert_called_once_with("user", "pass")
    smtp.send_message.assert_called_once()
