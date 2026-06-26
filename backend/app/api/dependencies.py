from collections.abc import Generator

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import TokenExpiredError, TokenInvalidError, decode_access_token
from app.db.session import get_db

_bearer = HTTPBearer(auto_error=False)


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> int:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail={"error": "Authentication required"})

    token = credentials.credentials
    try:
        return decode_access_token(token)
    except TokenExpiredError:
        raise HTTPException(
            status_code=401,
            detail={"error": "Session expired — please log in again"},
        ) from None
    except TokenInvalidError:
        raise HTTPException(status_code=401, detail={"error": "Invalid token"}) from None


def get_db_session() -> Generator[Session]:
    yield from get_db()
