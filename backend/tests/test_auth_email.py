"""Unit tests for email auth helpers."""

from app.services.auth_service import (
    SYNTHETIC_EMAIL_SUFFIX,
    _normalize_email,
    _optional_username_from_email,
    _validate_email,
)


def test_normalize_email():
    assert _normalize_email("  Alice@Example.COM ") == "alice@example.com"


def test_validate_email_rejects_synthetic_suffix():
    assert _validate_email(f"user{SYNTHETIC_EMAIL_SUFFIX}") is not None


def test_validate_email_accepts_real_address():
    assert _validate_email("user@example.com") is None


def test_optional_username_from_email():
    assert _optional_username_from_email("alice@example.com") == "alice"
    assert _optional_username_from_email("a@example.com") is None
