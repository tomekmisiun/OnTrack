from app.models.user import User


def user_to_dict(user: User) -> dict:
    out: dict = {
        "id": user.id,
        "lang": user.ui_locale,
        "ui_locale": user.ui_locale,
        "market_code": user.market_code,
    }
    if user.username:
        out["username"] = user.username
    if user.email and not user.email.endswith("@users.ontrack.local"):
        out["email"] = user.email
    return out
