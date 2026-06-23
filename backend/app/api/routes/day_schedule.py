from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user_id, get_db_session
from app.schemas.day_schedule import CreateBlockRequest, CreateBulkRequest, UpdateBlockRequest
from app.services import day_schedule_service

router = APIRouter(prefix="/api/day-schedule", tags=["day-schedule"])


def _service_error(exc: day_schedule_service.DayScheduleServiceError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"error": exc.message})


@router.get("/")
def get_blocks(
    member_id: int | None = Query(default=None),
    week_start: str | None = Query(default=None),
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        data = day_schedule_service.get_blocks(
            session,
            user_id,
            member_id=member_id,
            week_start_raw=week_start,
        )
    except day_schedule_service.DayScheduleServiceError as exc:
        return _service_error(exc)
    return JSONResponse(content=data)


@router.post("/", status_code=201)
def create_block(
    body: CreateBlockRequest,
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        data = day_schedule_service.create_block(
            session,
            user_id,
            week_start_raw=body.week_start,
            day=body.day,
            start_hour=body.start_hour,
            end_hour=body.end_hour,
            label=body.label,
            member_id=body.member_id,
        )
    except day_schedule_service.DayScheduleServiceError as exc:
        return _service_error(exc)
    return JSONResponse(status_code=201, content=data)


@router.post("/bulk")
def create_bulk(
    body: CreateBulkRequest,
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        data, status_code = day_schedule_service.create_bulk(
            session,
            user_id,
            week_start_raw=body.week_start,
            days=body.days,
            start_hour=body.start_hour,
            end_hour=body.end_hour,
            label=body.label,
            member_id=body.member_id,
        )
    except day_schedule_service.DayScheduleServiceError as exc:
        return _service_error(exc)
    return JSONResponse(status_code=status_code, content=data)


@router.delete("/week")
def delete_week_blocks(
    member_id: int | None = Query(default=None),
    week_start: str | None = Query(default=None),
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        data = day_schedule_service.delete_week_blocks(
            session,
            user_id,
            member_id=member_id,
            week_start_raw=week_start,
        )
    except day_schedule_service.DayScheduleServiceError as exc:
        return _service_error(exc)
    return JSONResponse(content=data)


@router.patch("/{block_id}")
def update_block(
    block_id: int,
    body: UpdateBlockRequest,
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        data = day_schedule_service.update_block(
            session,
            user_id,
            block_id,
            start_hour=body.start_hour,
            end_hour=body.end_hour,
            label=body.label,
        )
    except day_schedule_service.DayScheduleServiceError as exc:
        return _service_error(exc)
    return JSONResponse(content=data)


@router.delete("/{block_id}")
def delete_block(
    block_id: int,
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        data = day_schedule_service.delete_block(session, user_id, block_id)
    except day_schedule_service.DayScheduleServiceError as exc:
        return _service_error(exc)
    return JSONResponse(content=data)
