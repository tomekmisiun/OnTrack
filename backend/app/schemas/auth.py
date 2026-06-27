from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str = ""
    password: str = ""


class RegisterRequest(BaseModel):
    email: str = ""
    password: str = ""
    lang: str = "pl"


class ExchangeRequest(BaseModel):
    code: str = ""


class LanguageRequest(BaseModel):
    lang: str = ""


class MarketRequest(BaseModel):
    market_code: str = ""


class PasswordChangeRequest(BaseModel):
    current_password: str = ""
    new_password: str = ""


class ForgotPasswordRequest(BaseModel):
    email: str = ""


class ResetPasswordRequest(BaseModel):
    token: str = ""
    new_password: str = ""


class TokenResponse(BaseModel):
    token: str


class MessageResponse(BaseModel):
    message: str


class ErrorResponse(BaseModel):
    error: str


class UserResponse(BaseModel):
    id: int
    lang: str
    ui_locale: str
    market_code: str
    username: str | None = None
    email: str | None = None

    model_config = {"extra": "forbid"}
