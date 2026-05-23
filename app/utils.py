from flask_jwt_extended import get_jwt_identity

from app.models.user import User


def current_uid() -> int:
    return int(get_jwt_identity())


def current_user() -> User | None:
    return User.query.get(current_uid())


def current_user_lang() -> str:
    user = current_user()
    return user.lang if user and user.lang in ('pl', 'en') else 'pl'
