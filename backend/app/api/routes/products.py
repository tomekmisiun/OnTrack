from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user_id, get_db_session
from app.schemas.products import ProductCreateRequest, ProductUpdateRequest
from app.services import product_service

router = APIRouter(prefix="/api/products", tags=["products"])


def _service_error(exc: product_service.ProductServiceError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"error": exc.message})


@router.get("/")
def get_products(
    q: str | None = None,
    limit: int = 20,
    offset: int = 0,
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        data = product_service.list_products(session, user_id, q=q, limit=limit, offset=offset)
    except product_service.ProductServiceError as exc:
        return _service_error(exc)
    return JSONResponse(content=data)


@router.post("/", status_code=201)
def create_product(
    body: ProductCreateRequest,
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        data = product_service.create_product(session, user_id, body.model_dump())
    except product_service.ProductServiceError as exc:
        return _service_error(exc)
    return JSONResponse(status_code=201, content=data)


@router.delete("/all")
def delete_all_products(
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    count = product_service.delete_all_products(session, user_id)
    return JSONResponse(content={"message": f"Deleted {count} products"})


@router.post("/{product_id}/customize")
def customize_product(
    product_id: int,
    body: ProductUpdateRequest,
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        data = product_service.customize_product(
            session,
            user_id,
            product_id,
            body.model_dump(exclude_unset=True),
        )
    except product_service.ProductServiceError as exc:
        return _service_error(exc)
    return JSONResponse(content=data)


@router.put("/{product_id}")
def update_product(
    product_id: int,
    body: ProductUpdateRequest,
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        data = product_service.update_product(
            session,
            user_id,
            product_id,
            body.model_dump(exclude_unset=True),
        )
    except product_service.ProductServiceError as exc:
        return _service_error(exc)
    return JSONResponse(content=data)


@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        product_service.delete_product(session, user_id, product_id)
    except product_service.ProductServiceError as exc:
        return _service_error(exc)
    return JSONResponse(content={"message": "Product deleted"})
