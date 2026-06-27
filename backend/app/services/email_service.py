"""Outbound email helpers (stdlib SMTP)."""

from __future__ import annotations

import smtplib
from email.message import EmailMessage

from app.core.config import get_settings

SYNTHETIC_EMAIL_SUFFIX = "@users.ontrack.local"


class EmailDeliveryError(Exception):
    pass


def is_deliverable_email(email: str | None) -> bool:
    if not email:
        return False
    normalized = email.strip().lower()
    return not normalized.endswith(SYNTHETIC_EMAIL_SUFFIX)


def primary_frontend_origin() -> str:
    settings = get_settings()
    return settings.frontend_url.split(",")[0].strip().rstrip("/")


def password_reset_url(token: str) -> str:
    return f"{primary_frontend_origin()}/login?reset_token={token}"


def send_password_reset_email(
    *,
    to_email: str,
    reset_url: str,
    ui_locale: str,
) -> None:
    if ui_locale == "en":
        subject = "Reset your OnTrack password"
        body = (
            "We received a request to reset your OnTrack password.\n\n"
            f"Open this link to choose a new password (valid for 1 hour):\n{reset_url}\n\n"
            "If you did not request this, you can ignore this email."
        )
    else:
        subject = "Reset hasła OnTrack"
        body = (
            "Otrzymaliśmy prośbę o reset hasła do konta OnTrack.\n\n"
            f"Otwórz ten link, aby ustawić nowe hasło (ważny 1 godzinę):\n{reset_url}\n\n"
            "Jeśli to nie Ty, zignoruj tę wiadomość."
        )
    send_email(to=to_email, subject=subject, body_text=body)


def send_email(*, to: str, subject: str, body_text: str) -> None:
    settings = get_settings()
    if not settings.smtp_configured:
        raise EmailDeliveryError("SMTP is not configured")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from
    message["To"] = to
    message.set_content(body_text)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_user and settings.smtp_password:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(message)
    except OSError as exc:
        raise EmailDeliveryError(str(exc)) from exc
