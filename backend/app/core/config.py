from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "OnTrack API"
    debug: bool = False
    testing: bool = False
    host: str = "0.0.0.0"
    port: int = 8000
    database_url: str = Field(
        default="postgresql+psycopg://user:change-me@localhost:5432/mealplanner",
        validation_alias="DATABASE_URL",
    )

    app_secret_key: str = Field(default="dev-only-app-secret", validation_alias="FLASK_SECRET_KEY")
    jwt_secret_key: str = Field(default="dev-only-jwt-secret", validation_alias="JWT_SECRET_KEY")
    jwt_access_token_expires_seconds: int = 60 * 60 * 24 * 7

    google_client_id: str | None = Field(default=None, validation_alias="GOOGLE_CLIENT_ID")
    google_client_secret: str | None = Field(default=None, validation_alias="GOOGLE_CLIENT_SECRET")
    google_redirect_uri: str = Field(
        default="http://localhost:5001/api/auth/google/callback",
        validation_alias="GOOGLE_REDIRECT_URI",
    )
    frontend_url: str = Field(default="http://localhost:3000", validation_alias="FRONTEND_URL")
    auth_code_ttl_seconds: int = Field(default=120, validation_alias="AUTH_CODE_TTL_SECONDS")

    pexels_api_key: str | None = Field(default=None, validation_alias="PEXELS_API_KEY")
    gemini_api_key: str | None = Field(default=None, validation_alias="GEMINI_API_KEY")
    redis_url: str | None = Field(default=None, validation_alias="REDIS_URL")

    user_seeds_dir: str | None = None

    @property
    def google_oauth_configured(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)


@lru_cache
def get_settings() -> Settings:
    import os

    settings = Settings()
    url = os.environ.get("DATABASE_URL", settings.database_url)
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://") and "+psycopg" not in url:
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    elif url.startswith("sqlite://"):
        url = url  # tests

    return settings.model_copy(
        update={
            "database_url": url,
            "testing": os.environ.get("TESTING", "").lower() in ("1", "true", "yes"),
            "debug": os.environ.get("DEBUG", os.environ.get("BACKEND_DEBUG", "")).lower()
            in ("1", "true", "yes"),
        }
    )
