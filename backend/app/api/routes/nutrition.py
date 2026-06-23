from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user_id, get_db_session
from app.models.user import User
from app.services.macro_lookup import lookup_macros

router = APIRouter(prefix="/api/nutrition", tags=["nutrition"])


def _user_lang(session: Session, user_id: int) -> str:
    user = session.get(User, user_id)
    if user and user.lang in ("pl", "en"):
        return user.lang
    return "pl"


@router.get("/lookup")
def lookup(
    name: str | None = Query(default=None),
    lang: str | None = Query(default=None),
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    cleaned = (name or "").strip()
    if not cleaned:
        return JSONResponse(status_code=400, content={"error": "Product name is required"})

    resolved_lang = lang or _user_lang(session, user_id)
    result = lookup_macros(cleaned, resolved_lang)
    if result.get("found"):
        return JSONResponse(content=result)
    return JSONResponse(status_code=404, content=result)
