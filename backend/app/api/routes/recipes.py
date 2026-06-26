from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user_id, get_db_session
from app.schemas.recipes import RecipeCategoryRequest, RecipeCreateRequest, RecipeUpdateRequest
from app.services import recipe_service

router = APIRouter(prefix="/api/recipes", tags=["recipes"])


def _service_error(exc: recipe_service.RecipeServiceError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"error": exc.message})


@router.get("/")
def list_recipes(
    own_only: bool = False,
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    return JSONResponse(content=recipe_service.list_recipes(session, user_id, own_only=own_only))


@router.post("/", status_code=201)
def create_recipe(
    body: RecipeCreateRequest,
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        data = recipe_service.create_recipe(session, user_id, body.model_dump())
    except recipe_service.RecipeServiceError as exc:
        return _service_error(exc)
    return JSONResponse(status_code=201, content=data)


@router.delete("/all")
def delete_all_recipes(
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    count = recipe_service.delete_all_recipes(session, user_id)
    return JSONResponse(content={"message": f"Deleted {count} recipes"})


@router.get("/{recipe_id}")
def get_recipe(
    recipe_id: int,
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        data = recipe_service.get_recipe(session, user_id, recipe_id)
    except recipe_service.RecipeServiceError as exc:
        return _service_error(exc)
    return JSONResponse(content=data)


@router.put("/{recipe_id}")
def update_recipe(
    recipe_id: int,
    body: RecipeUpdateRequest,
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        data = recipe_service.update_recipe(
            session,
            user_id,
            recipe_id,
            body.model_dump(exclude_unset=True),
        )
    except recipe_service.RecipeServiceError as exc:
        return _service_error(exc)
    return JSONResponse(content=data)


@router.patch("/{recipe_id}/favorite")
def toggle_favorite(
    recipe_id: int,
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        data = recipe_service.toggle_favorite(session, user_id, recipe_id)
    except recipe_service.RecipeServiceError as exc:
        return _service_error(exc)
    return JSONResponse(content=data)


@router.patch("/{recipe_id}/category")
def update_category(
    recipe_id: int,
    body: RecipeCategoryRequest,
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        data = recipe_service.update_category(session, user_id, recipe_id, body.category)
    except recipe_service.RecipeServiceError as exc:
        return _service_error(exc)
    return JSONResponse(content=data)


@router.post("/{recipe_id}/fetch-image")
def fetch_recipe_image(
    recipe_id: int,
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        data = recipe_service.fetch_recipe_image(session, user_id, recipe_id)
    except recipe_service.RecipeServiceError as exc:
        return _service_error(exc)
    return JSONResponse(content=data)


@router.delete("/{recipe_id}")
def delete_recipe(
    recipe_id: int,
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        recipe_service.delete_recipe(session, user_id, recipe_id)
    except recipe_service.RecipeServiceError as exc:
        return _service_error(exc)
    return JSONResponse(content={"message": "Recipe deleted"})
