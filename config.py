import os


def _env_bool(name: str, default: bool = False) -> bool:
    val = os.environ.get(name)
    if val is None:
        return default
    return val.lower() in ('1', 'true', 'yes', 'on')


def _is_dev_mode() -> bool:
    if _env_bool('FLASK_DEBUG'):
        return True
    return os.environ.get('FLASK_ENV', '').lower() in ('development', 'dev')


def _require_secret(name: str, dev_fallback: str) -> str:
    value = os.environ.get(name)
    if value:
        return value
    if _is_dev_mode():
        return dev_fallback
    raise RuntimeError(
        f'{name} must be set in the environment. '
        f'Set FLASK_DEBUG=1 only for local development without secrets.'
    )


def _database_url() -> str:
    url = os.environ.get('DATABASE_URL')
    if not url:
        if os.environ.get('RAILWAY_ENVIRONMENT') or os.environ.get('RAILWAY_PROJECT_ID'):
            raise RuntimeError(
                'DATABASE_URL is not set. Connect Postgres to the backend service in Railway '
                '(Variables → DATABASE_URL → ${{Postgres.DATABASE_URL}}).'
            )
        url = 'postgresql://user:password@db:5432/mealplanner'
    # Railway Postgres uses postgres:// — SQLAlchemy needs postgresql://
    if url.startswith('postgres://'):
        url = url.replace('postgres://', 'postgresql://', 1)
    return url


class Config:
    SQLALCHEMY_DATABASE_URI = _database_url()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    FLASK_DEBUG = _env_bool('FLASK_DEBUG')
    SECRET_KEY = _require_secret('FLASK_SECRET_KEY', 'dev-only-flask-secret')
    JWT_SECRET_KEY = _require_secret('JWT_SECRET_KEY', 'dev-only-jwt-secret')
    JWT_ACCESS_TOKEN_EXPIRES = 60 * 60 * 24 * 7  # 7 dni
    GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
    GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')
    GOOGLE_REDIRECT_URI = os.environ.get(
        'GOOGLE_REDIRECT_URI', 'http://localhost:5001/api/auth/google/callback'
    )
    FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
    AUTH_CODE_TTL_SECONDS = int(os.environ.get('AUTH_CODE_TTL_SECONDS', '120'))
