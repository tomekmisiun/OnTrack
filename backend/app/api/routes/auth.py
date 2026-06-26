from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user_id, get_db_session
from app.core.config import get_settings
from app.core.rate_limit import check_rate_limit
from app.schemas.auth import (
    ExchangeRequest,
    ForgotPasswordRequest,
    LanguageRequest,
    LoginRequest,
    MarketRequest,
    MessageResponse,
    PasswordChangeRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
)
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])

_oauth: OAuth | None = None


def get_oauth() -> OAuth:
    global _oauth
    if _oauth is None:
        settings = get_settings()
        oauth = OAuth()
        if settings.google_oauth_configured:
            oauth.register(
                name="google",
                client_id=settings.google_client_id,
                client_secret=settings.google_client_secret,
                server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
                client_kwargs={"scope": "openid email"},
            )
        _oauth = oauth
    return _oauth


def _service_error(exc: auth_service.AuthServiceError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"error": exc.message})


@router.post("/login", response_model=TokenResponse)
def login(
    body: LoginRequest,
    request: Request,
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    check_rate_limit(request, scope="auth_login", max_requests=20, window_seconds=60)
    try:
        token = auth_service.login(session, body.username, body.password)
    except auth_service.AuthServiceError as exc:
        return _service_error(exc)
    return JSONResponse(content={"token": token})


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(
    body: RegisterRequest,
    request: Request,
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    check_rate_limit(request, scope="auth_register", max_requests=10, window_seconds=60)
    try:
        token = auth_service.register(session, body.username, body.password, body.lang)
    except auth_service.AuthServiceError as exc:
        return _service_error(exc)
    return JSONResponse(status_code=201, content={"token": token})


@router.post("/exchange", response_model=TokenResponse)
def exchange(
    body: ExchangeRequest,
    request: Request,
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    check_rate_limit(request, scope="auth_exchange", max_requests=30, window_seconds=60)
    try:
        token = auth_service.exchange_code(session, body.code)
    except auth_service.AuthServiceError as exc:
        return _service_error(exc)
    return JSONResponse(content={"token": token})


@router.get("/me")
def me(
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        data = auth_service.get_me(session, user_id)
    except auth_service.AuthServiceError as exc:
        return _service_error(exc)
    return JSONResponse(content=data)


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        token = auth_service.refresh_session(session, user_id)
    except auth_service.AuthServiceError as exc:
        return _service_error(exc)
    return JSONResponse(content={"token": token})


@router.patch("/password", response_model=MessageResponse)
def change_password(
    body: PasswordChangeRequest,
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        auth_service.change_password(
            session,
            user_id,
            current_password=body.current_password,
            new_password=body.new_password,
        )
    except auth_service.AuthServiceError as exc:
        return _service_error(exc)
    return JSONResponse(content={"message": "Password updated"})


@router.post("/forgot-password")
def forgot_password(
    body: ForgotPasswordRequest,
    request: Request,
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    check_rate_limit(request, scope="auth_forgot", max_requests=10, window_seconds=60)
    data = auth_service.forgot_password(session, body.username)
    return JSONResponse(content=data)


@router.post("/reset-password", response_model=TokenResponse)
def reset_password(
    body: ResetPasswordRequest,
    request: Request,
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    check_rate_limit(request, scope="auth_reset", max_requests=10, window_seconds=60)
    try:
        token = auth_service.reset_password(
            session,
            token=body.token,
            new_password=body.new_password,
        )
    except auth_service.AuthServiceError as exc:
        return _service_error(exc)
    return JSONResponse(content={"token": token})


@router.patch("/language")
def change_language(
    body: LanguageRequest,
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        data = auth_service.change_language(session, user_id, body.lang)
    except auth_service.AuthServiceError as exc:
        return _service_error(exc)
    return JSONResponse(content=data)


@router.patch("/market")
def change_market(
    body: MarketRequest,
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        data = auth_service.change_market(session, user_id, body.market_code)
    except auth_service.AuthServiceError as exc:
        return _service_error(exc)
    return JSONResponse(content=data)


@router.delete("/me", response_model=MessageResponse)
def delete_me(
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        auth_service.delete_account(session, user_id)
    except auth_service.AuthServiceError as exc:
        return _service_error(exc)
    return JSONResponse(content={"message": "Account deleted"})


@router.get("/google")
async def google_login(request: Request) -> Response:
    settings = get_settings()
    if not settings.google_oauth_configured:
        return JSONResponse(
            status_code=503,
            content={"error": "Google OAuth is not configured"},
        )

    oauth = get_oauth()
    pending_lang = request.query_params.get("lang") or request.cookies.get("pending_lang") or "pl"
    if pending_lang not in ("pl", "en"):
        pending_lang = "pl"

    redirect_uri = settings.google_redirect_uri
    response = await oauth.google.authorize_redirect(request, redirect_uri)
    secure = not settings.debug
    response.set_cookie(
        key="pending_lang",
        value=pending_lang,
        max_age=300,
        httponly=True,
        samesite="none" if secure else "lax",
        secure=secure,
    )
    return response


@router.get("/google/callback")
async def google_callback(request: Request, session: Session = Depends(get_db_session)) -> Response:
    settings = get_settings()
    if not settings.google_oauth_configured:
        return RedirectResponse(auth_service.auth_error_redirect("oauth_not_configured"))

    oauth = get_oauth()
    pending_lang = request.cookies.get("pending_lang") or "pl"

    try:
        token = await oauth.google.authorize_access_token(request)
        userinfo = token.get("userinfo")
        if not userinfo:
            userinfo = await oauth.google.userinfo(token=token)
        email = (userinfo.get("email") or "").lower()
        location = auth_service.handle_oauth_callback(session, email, pending_lang)
        return RedirectResponse(location, status_code=302)
    except Exception as exc:
        try:
            from authlib.integrations.base_client.errors import OAuthError

            if isinstance(exc, OAuthError):
                return RedirectResponse(
                    auth_service.auth_error_redirect("oauth_denied"),
                    status_code=302,
                )
        except ImportError:
            pass
        return RedirectResponse(
            auth_service.auth_error_redirect("oauth_failed"),
            status_code=302,
        )
