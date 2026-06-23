from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.services import fuel_service

router = APIRouter(prefix="/api/fuel", tags=["fuel"])


@router.get("/prices")
def get_fuel_prices(lang: str = Query(default="pl")) -> JSONResponse:
    data, status_code = fuel_service.get_fuel_prices(lang)
    return JSONResponse(status_code=status_code, content=data)
