from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user_id, get_db_session
from app.schemas.members import MemberNameRequest, MemberProfileRequest
from app.services import member_service

router = APIRouter(prefix="/api/members", tags=["members"])


def _service_error(exc: member_service.MemberServiceError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"error": exc.message})


@router.get("/")
def list_members(
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    return JSONResponse(content=member_service.list_members(session, user_id))


@router.post("/", status_code=201)
def create_member(
    body: MemberNameRequest,
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        data = member_service.create_member(session, user_id, body.name)
    except member_service.MemberServiceError as exc:
        return _service_error(exc)
    return JSONResponse(status_code=201, content=data)


@router.patch("/{member_id}")
def rename_member(
    member_id: int,
    body: MemberNameRequest,
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        data = member_service.rename_member(session, user_id, member_id, body.name)
    except member_service.MemberServiceError as exc:
        return _service_error(exc)
    return JSONResponse(content=data)


@router.delete("/{member_id}")
def delete_member(
    member_id: int,
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        member_service.delete_member(session, user_id, member_id)
    except member_service.MemberServiceError as exc:
        return _service_error(exc)
    return JSONResponse(content={"message": "Deleted"})


@router.patch("/{member_id}/profile")
def save_profile(
    member_id: int,
    body: MemberProfileRequest,
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        data = member_service.save_profile(
            session,
            user_id,
            member_id,
            body.model_dump(exclude_unset=True),
        )
    except member_service.MemberServiceError as exc:
        return _service_error(exc)
    return JSONResponse(content=data)
