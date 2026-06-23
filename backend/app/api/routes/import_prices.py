from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user_id, get_db_session
from app.schemas.import_prices import ApplyPricesRequest
from app.services import import_service

router = APIRouter(prefix="/api/import", tags=["import"])


def _service_error(exc: import_service.ImportServiceError) -> JSONResponse:
    content: dict = {"error": exc.message}
    if exc.code:
        content["code"] = exc.code
    return JSONResponse(status_code=exc.status_code, content=content)


async def _read_upload(file: UploadFile) -> tuple[str | None, bytes]:
    if file is None:
        raise import_service.ImportServiceError("No file provided", 400)
    data = await file.read(import_service.MAX_FILE_SIZE + 1)
    return file.filename, data


@router.post("/parse")
async def parse_receipt(
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        filename, file_data = await _read_upload(file)
        data = import_service.parse_receipt(
            session,
            user_id,
            filename=filename,
            file_data=file_data,
        )
    except import_service.ImportServiceError as exc:
        return _service_error(exc)
    return JSONResponse(content=data)


@router.post("/parse-free")
async def parse_free(
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        filename, file_data = await _read_upload(file)
        data = import_service.parse_free(
            session,
            user_id,
            filename=filename,
            file_data=file_data,
        )
    except import_service.ImportServiceError as exc:
        return _service_error(exc)
    return JSONResponse(content=data)


@router.post("/apply")
def apply_prices(
    body: ApplyPricesRequest,
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        data = import_service.apply_prices(session, user_id, body.updates)
    except import_service.ImportServiceError as exc:
        return _service_error(exc)
    return JSONResponse(content=data)
