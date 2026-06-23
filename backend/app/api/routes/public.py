from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.services.dish_compare_loader import load_dish_compare

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get("/dish-compare")
def dish_compare(lang: str = Query(default="pl")) -> JSONResponse:
    if lang not in ("pl", "en"):
        lang = "pl"
    try:
        return JSONResponse(content=load_dish_compare(lang))
    except FileNotFoundError as exc:
        return JSONResponse(status_code=503, content={"error": str(exc)})
