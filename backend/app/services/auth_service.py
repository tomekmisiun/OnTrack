from __future__ import annotations

import re
import secrets
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.passwords import hash_password, verify_password
from app.core.security import create_access_token
from app.models.auth_code import AuthCode
from app.models.day_schedule import DayScheduleBlock
from app.models.household_member import HouseholdMember
from app.models.import_log import ImportLog
from app.models.meal_plan import MealPlan
from app.models.product import Product
from app.models.recipe import Recipe, RecipeIngredient
from app.models.recipe_parse_log import RecipeParseLog
from app.models.user import User
from app.services.catalog_seed_service import ensure_catalog_if_incomplete, ensure_user_seeded
from app.services.member_service import ensure_primary_member, sync_primary_member_name
from app.services.user_presenter import user_to_dict
from app.worker.queue import enqueue_catalog_seed

USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,80}$")
MIN_PASSWORD_LEN = 8


class AuthServiceError(Exception):
    def __init__(self, message: str, status_code: int):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def _normalize_username(raw: str) -> str:
    return (raw or "").strip().lower()


def _validate_username(username: str) -> str | None:
    if not USERNAME_RE.match(username):
        return "Username must be 3–80 characters (letters, numbers, underscore only)"
    return None


def _validate_password(password: str) -> str | None:
    if len(password or "") < MIN_PASSWORD_LEN:
        return f"Password must be at least {MIN_PASSWORD_LEN} characters"
    return None


def _synthetic_email(username: str) -> str:
    return f"{username}@users.ontrack.local"


def issue_token(user_id: int) -> str:
    return create_access_token(user_id)


def _schedule_catalog_seed(user_id: int, lang: str) -> None:
    enqueue_catalog_seed(user_id, lang)


def login(session: Session, username: str, password: str) -> str:
    username = _normalize_username(username)
    if not username or not password:
        raise AuthServiceError("Username and password are required", 400)

    user = session.query(User).filter_by(username=username).first()
    if not user or not verify_password(user.password_hash, password):
        raise AuthServiceError("Invalid username or password", 401)

    ensure_catalog_if_incomplete(session, user.id, user.lang)
    sync_primary_member_name(session, user)
    return issue_token(user.id)


def register(session: Session, username: str, password: str, lang: str) -> str:
    username = _normalize_username(username)
    if lang not in ("pl", "en"):
        lang = "pl"

    err = _validate_username(username) or _validate_password(password)
    if err:
        raise AuthServiceError(err, 400)

    if session.query(User).filter_by(username=username).first():
        raise AuthServiceError("Username already taken", 409)

    user = User(
        email=_synthetic_email(username),
        username=username,
        lang=lang,
        password_hash=hash_password(password),
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    ensure_primary_member(session, user.id, lang)
    ensure_user_seeded(session, user.id, lang)
    _schedule_catalog_seed(user.id, lang)
    return issue_token(user.id)


def get_me(session: Session, user_id: int) -> dict:
    user = session.get(User, user_id)
    if not user:
        raise AuthServiceError("User not found", 404)

    ensure_catalog_if_incomplete(session, user.id, user.lang)
    _schedule_catalog_seed(user.id, user.lang)
    sync_primary_member_name(session, user)
    return user_to_dict(user)


def change_language(session: Session, user_id: int, lang: str) -> dict:
    if lang not in ("pl", "en"):
        raise AuthServiceError("Invalid language", 400)

    user = session.get(User, user_id)
    if not user:
        raise AuthServiceError("User not found", 404)

    user.lang = lang
    session.commit()
    ensure_catalog_if_incomplete(session, user.id, lang)
    _schedule_catalog_seed(user.id, lang)
    sync_primary_member_name(session, user)
    return user_to_dict(user)


def delete_account(session: Session, user_id: int) -> None:
    user = session.get(User, user_id)
    if not user:
        raise AuthServiceError("User not found", 404)

    session.query(MealPlan).filter_by(user_id=user_id).delete()
    session.query(DayScheduleBlock).filter_by(user_id=user_id).delete()
    session.query(HouseholdMember).filter_by(user_id=user_id).delete()
    recipe_ids = [r.id for r in session.query(Recipe).filter_by(user_id=user_id).all()]
    if recipe_ids:
        session.query(RecipeIngredient).filter(
            RecipeIngredient.recipe_id.in_(recipe_ids)
        ).delete(synchronize_session=False)
    session.query(Recipe).filter_by(user_id=user_id).delete()
    session.query(Product).filter_by(user_id=user_id).delete()
    session.query(ImportLog).filter_by(user_id=user_id).delete()
    session.query(RecipeParseLog).filter_by(user_id=user_id).delete()
    session.delete(user)
    session.commit()


def _cleanup_expired_codes(session: Session) -> None:
    now = datetime.now(UTC).replace(tzinfo=None)
    session.query(AuthCode).filter(
        or_(AuthCode.expires_at < now, AuthCode.used_at.isnot(None))
    ).delete(synchronize_session=False)
    session.commit()


def issue_auth_code(session: Session, user_id: int, ttl_seconds: int | None = None) -> str:
    settings = get_settings()
    ttl = ttl_seconds if ttl_seconds is not None else settings.auth_code_ttl_seconds
    _cleanup_expired_codes(session)
    code = secrets.token_urlsafe(32)
    now = datetime.utcnow()
    session.add(
        AuthCode(
            code=code,
            user_id=user_id,
            created_at=now,
            expires_at=now + timedelta(seconds=ttl),
        )
    )
    session.commit()
    return code


def redeem_auth_code(session: Session, code: str) -> User:
    if not code or len(code) > 64:
        raise AuthServiceError("Invalid or expired code", 401)

    now = datetime.utcnow()
    row = session.query(AuthCode).filter_by(code=code).first()
    if not row or row.used_at or row.expires_at < now:
        raise AuthServiceError("Invalid or expired code", 401)

    user = session.get(User, row.user_id)
    if not user:
        raise AuthServiceError("Invalid or expired code", 401)

    row.used_at = now
    session.commit()
    return user


def exchange_code(session: Session, code: str) -> str:
    code = (code or "").strip()
    if not code:
        raise AuthServiceError("Code is required", 400)
    user = redeem_auth_code(session, code)
    return issue_token(user.id)


def find_or_create_oauth_user(session: Session, email: str) -> tuple[User, bool]:
    email = email.lower()
    user = session.query(User).filter_by(email=email).first()
    if user:
        return user, False
    user = User(email=email, password_hash=hash_password(secrets.token_hex(32)))
    session.add(user)
    session.commit()
    session.refresh(user)
    return user, True


def frontend_redirect_path(path_query: str) -> str:
    settings = get_settings()
    base = settings.frontend_url.rstrip("/")
    return f"{base}/{path_query.lstrip('/')}"


def auth_error_redirect(message: str) -> str:
    return frontend_redirect_path(f"?{urlencode({'auth_error': message[:220]})}")


def oauth_success_redirect(code: str) -> str:
    return frontend_redirect_path(f"?{urlencode({'code': code})}")


def handle_oauth_callback(
    session: Session,
    email: str,
    pending_lang: str,
) -> str:
    if not email:
        return auth_error_redirect("No email returned from Google")

    lang = pending_lang if pending_lang in ("pl", "en") else "pl"
    user, is_new = find_or_create_oauth_user(session, email)

    if is_new:
        user.lang = lang
        session.commit()
        ensure_primary_member(session, user.id, lang)
        ensure_user_seeded(session, user.id, lang)
    else:
        ensure_primary_member(session, user.id, user.lang or lang)

    settings = get_settings()
    code = issue_auth_code(session, user.id, ttl_seconds=settings.auth_code_ttl_seconds)
    return oauth_success_redirect(code)
