from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt

from app.core.config import get_settings


class TokenError(Exception):
    """Base JWT validation error."""


class TokenExpiredError(TokenError):
    pass


class TokenInvalidError(TokenError):
    pass


def create_access_token(user_id: int) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(seconds=settings.jwt_access_token_expires_seconds),
        "fresh": False,
        "type": "access",
        "jti": uuid4().hex,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm="HS256")


def decode_access_token(token: str) -> int:
    return _decode_token(token, expected_type="access")


def create_password_reset_token(user_id: int) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(hours=1),
        "type": "password_reset",
        "jti": uuid4().hex,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm="HS256")


def decode_password_reset_token(token: str) -> int:
    return _decode_token(token, expected_type="password_reset")


def _decode_token(token: str, *, expected_type: str) -> int:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=["HS256"],
            options={"require": ["sub", "exp", "type"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise TokenExpiredError from exc
    except jwt.InvalidTokenError as exc:
        raise TokenInvalidError from exc

    if payload.get("type") != expected_type:
        raise TokenInvalidError("invalid token type")

    sub = payload.get("sub")
    if sub is None:
        raise TokenInvalidError("missing sub")
    return int(sub)
