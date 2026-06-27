from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user_id, get_db_session
from app.services.macro_lookup import lookup_macros
from app.services.user_preferences import ui_locale_for_user

router = APIRouter(prefix="/api/nutrition", tags=["nutrition"])


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

    resolved_lang = lang or ui_locale_for_user(session, user_id)
    result = lookup_macros(cleaned, resolved_lang)
    if result.get("found"):
        return JSONResponse(content=result)
    return JSONResponse(status_code=404, content=result)
