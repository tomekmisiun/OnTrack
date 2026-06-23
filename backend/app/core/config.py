from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "OnTrack API"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8000
    database_url: str = "postgresql+psycopg://user:change-me@localhost:5432/mealplanner"


@lru_cache
def get_settings() -> Settings:
    return Settings()
