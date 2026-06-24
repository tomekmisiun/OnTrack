"""Resolve ui_locale, market_code, and catalog language for a user."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.domain.market import (
    catalog_lang_for_market,
    default_market_for_ui_locale,
    normalize_market_code,
    normalize_ui_locale,
)
from app.models.user import User


def sync_legacy_lang(user: User) -> None:
    """Keep users.lang aligned with ui_locale for API compatibility."""
    user.lang = user.ui_locale


def apply_ui_locale(user: User, ui_locale: str) -> None:
    user.ui_locale = normalize_ui_locale(ui_locale)
    sync_legacy_lang(user)


def apply_market_code(user: User, market_code: str) -> None:
    user.market_code = normalize_market_code(market_code, ui_locale=user.ui_locale)


def init_user_preferences(user: User, ui_locale: str, market_code: str | None = None) -> None:
    locale = normalize_ui_locale(ui_locale)
    user.ui_locale = locale
    user.market_code = normalize_market_code(market_code, ui_locale=locale)
    sync_legacy_lang(user)


def get_user(session: Session, user_id: int) -> User | None:
    return session.get(User, user_id)


def ui_locale_for_user(session: Session, user_id: int) -> str:
    user = get_user(session, user_id)
    if not user:
        return "pl"
    if user.ui_locale in ("pl", "en"):
        return user.ui_locale
    return normalize_ui_locale(user.lang)


def market_code_for_user(session: Session, user_id: int) -> str:
    user = get_user(session, user_id)
    if not user:
        return "PL"
    if user.market_code in ("PL", "GB"):
        return user.market_code
    return default_market_for_ui_locale(ui_locale_for_user(session, user_id))


def catalog_lang_for_user(session: Session, user_id: int) -> str:
    return catalog_lang_for_market(market_code_for_user(session, user_id))
