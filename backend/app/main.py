from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import HTTPException, RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.middleware.sessions import SessionMiddleware

from app.api.dependencies import get_db_session
from app.api.routes.auth import router as auth_router
from app.api.routes.day_schedule import router as day_schedule_router
from app.api.routes.fuel import router as fuel_router
from app.api.routes.import_prices import router as import_router
from app.api.routes.meal_plan import router as meal_plan_router
from app.api.routes.members import router as members_router
from app.api.routes.nutrition import router as nutrition_router
from app.api.routes.products import router as products_router
from app.api.routes.public import router as public_router
from app.api.routes.recipes import router as recipes_router
from app.core.config import get_settings
from app.core.cors import cors_allowed_origins
from app.core.sentry import init_sentry

_http_requests_total = 0


def create_app() -> FastAPI:
    settings = get_settings()
    init_sentry(settings)

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        if not settings.testing:
            from app.db.session import get_session_factory
            from app.scripts.import_catalog import ensure_global_catalog_loaded

            session = get_session_factory()()
            try:
                ensure_global_catalog_loaded(session)
            finally:
                session.close()
        yield

    app = FastAPI(title=settings.app_name, debug=settings.debug, lifespan=lifespan)

    app.add_middleware(SessionMiddleware, secret_key=settings.app_secret_key)

    origins = cors_allowed_origins(
        settings.frontend_url,
        debug=settings.debug,
        testing=settings.testing,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def count_http_requests(request: Request, call_next):
        global _http_requests_total
        _http_requests_total += 1
        return await call_next(request)

    @app.exception_handler(HTTPException)
    async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
        if isinstance(exc.detail, dict):
            return JSONResponse(status_code=exc.status_code, content=exc.detail)
        return JSONResponse(status_code=exc.status_code, content={"error": str(exc.detail)})

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        _request: Request, _exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(status_code=422, content={"error": "Validation error"})

    @app.get("/health")
    def health() -> dict[str, str | bool]:
        settings = get_settings()
        return {
            "status": "ok",
            "google_oauth": settings.google_oauth_configured,
        }

    @app.get("/health/ready")
    def health_ready(session: Session = Depends(get_db_session)) -> JSONResponse:
        try:
            session.execute(text("SELECT 1"))
        except Exception:
            return JSONResponse(
                status_code=503,
                content={"status": "degraded", "database": "error"},
            )
        return JSONResponse(content={"status": "ok", "database": "ok"})

    @app.get("/metrics")
    def metrics(session: Session = Depends(get_db_session)) -> Response:
        try:
            session.execute(text("SELECT 1"))
            db_up = 1
        except Exception:
            db_up = 0
        body = "\n".join(
            [
                "# HELP ontrack_up OnTrack API process is running",
                "# TYPE ontrack_up gauge",
                "ontrack_up 1",
                "# HELP ontrack_db_up Database connectivity (1 = ok)",
                "# TYPE ontrack_db_up gauge",
                f"ontrack_db_up {db_up}",
                "# HELP ontrack_http_requests_total Total HTTP requests handled by this process",
                "# TYPE ontrack_http_requests_total counter",
                f"ontrack_http_requests_total {_http_requests_total}",
                "",
            ]
        )
        return Response(content=body, media_type="text/plain; version=0.0.4; charset=utf-8")


    app.include_router(auth_router)
    app.include_router(members_router)
    app.include_router(products_router)
    app.include_router(recipes_router)
    app.include_router(meal_plan_router)
    app.include_router(day_schedule_router)
    app.include_router(nutrition_router)
    app.include_router(fuel_router)
    app.include_router(import_router)
    app.include_router(public_router)

    return app


app = create_app()
