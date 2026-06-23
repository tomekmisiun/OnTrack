from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str = ""
    password: str = ""


class RegisterRequest(BaseModel):
    username: str = ""
    password: str = ""
    lang: str = "pl"


class ExchangeRequest(BaseModel):
    code: str = ""


class LanguageRequest(BaseModel):
    lang: str = ""


class TokenResponse(BaseModel):
    token: str


class MessageResponse(BaseModel):
    message: str


class ErrorResponse(BaseModel):
    error: str


class UserResponse(BaseModel):
    id: int
    lang: str
    username: str | None = None
    email: str | None = None

    model_config = {"extra": "forbid"}
