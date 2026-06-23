from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user_id, get_db_session
from app.schemas.meal_plan import AddMealRequest, CopyRangeRequest
from app.services import meal_plan_service

router = APIRouter(prefix="/api/meal-plan", tags=["meal-plan"])


def _service_error(exc: meal_plan_service.MealPlanServiceError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"error": exc.message})


def _parse_date(value: str) -> date:
    return date.fromisoformat(value)


@router.get("/range/{start}/{end}")
def get_range(
    start: str,
    end: str,
    member_ids: str | None = Query(default=None),
    member_id: int | None = Query(default=None),
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        start_date = _parse_date(start)
        end_date = _parse_date(end)
    except ValueError:
        return JSONResponse(status_code=400, content={"error": "Invalid date format"})
    data = meal_plan_service.get_range(
        session,
        user_id,
        start_date,
        end_date,
        member_ids=member_ids,
        member_id=member_id,
    )
    return JSONResponse(content=data)


@router.get("/summary/{start}/{end}")
def get_summary(
    start: str,
    end: str,
    member_ids: str | None = Query(default=None),
    member_id: int | None = Query(default=None),
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        start_date = _parse_date(start)
        end_date = _parse_date(end)
    except ValueError:
        return JSONResponse(status_code=400, content={"error": "Invalid date format"})
    data = meal_plan_service.get_summary(
        session,
        user_id,
        start_date,
        end_date,
        member_ids=member_ids,
        member_id=member_id,
    )
    return JSONResponse(content=data)


@router.post("/copy", status_code=201)
def copy_range(
    body: CopyRangeRequest,
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        source_start = _parse_date(body.source_start)
        source_end = _parse_date(body.source_end)
        target_start = _parse_date(body.target_start)
    except ValueError:
        return JSONResponse(status_code=400, content={"error": "Invalid date format"})
    try:
        data = meal_plan_service.copy_range(
            session,
            user_id,
            source_start=source_start,
            source_end=source_end,
            target_start=target_start,
            member_id=body.member_id,
        )
    except meal_plan_service.MealPlanServiceError as exc:
        return _service_error(exc)
    return JSONResponse(status_code=201, content=data)


@router.post("/")
def add_meal(
    body: AddMealRequest,
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        day = _parse_date(body.date)
    except ValueError:
        return JSONResponse(status_code=400, content={"error": "Invalid date format"})
    try:
        data, status_code = meal_plan_service.add_meal(
            session,
            user_id,
            day=day,
            position=body.position,
            recipe_id=body.recipe_id,
            member_id=body.member_id,
        )
    except meal_plan_service.MealPlanServiceError as exc:
        return _service_error(exc)
    return JSONResponse(status_code=status_code, content=data)


@router.get("/{date_str}")
def get_day(
    date_str: str,
    member_ids: str | None = Query(default=None),
    member_id: int | None = Query(default=None),
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        day = _parse_date(date_str)
    except ValueError:
        return JSONResponse(status_code=400, content={"error": "Invalid date format"})
    data = meal_plan_service.get_day(
        session,
        user_id,
        day,
        member_ids=member_ids,
        member_id=member_id,
    )
    return JSONResponse(content=data)


@router.delete("/{meal_id}")
def delete_meal(
    meal_id: int,
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        data = meal_plan_service.delete_meal(session, user_id, meal_id)
    except meal_plan_service.MealPlanServiceError as exc:
        return _service_error(exc)
    return JSONResponse(content=data)
