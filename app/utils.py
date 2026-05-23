from flask_jwt_extended import get_jwt_identity
import re

from app.models.user import User

_RECIPE_LINE = re.compile(
    r"(\d+\s*-\s*\d+|\d+\s*(g|ml|kg|l\b|szt|łyż|szkl|gram|centymetr|cm\b)|"
    r"u mnie|np\.|ulubion|świeżo wyciśni|według przepisu)",
    re.I,
)


def looks_like_recipe_ingredient_line(name: str) -> bool:
    """True when a product name looks like a raw recipe line, not a shop ingredient."""
    return bool(_RECIPE_LINE.search(name or ""))


def current_uid() -> int:
    return int(get_jwt_identity())


def current_user() -> User | None:
    return User.query.get(current_uid())


def current_user_lang() -> str:
    user = current_user()
    return user.lang if user and user.lang in ('pl', 'en') else 'pl'


def default_primary_member_name(lang: str) -> str:
    return 'Me' if lang == 'en' else 'Ja'


def sync_primary_member_name(user: User) -> bool:
    """Rename default primary profile (Me/Ja) to match user language."""
    from app.models.household_member import HouseholdMember
    from app import db

    if not user:
        return False
    lang = user.lang if user.lang in ('pl', 'en') else 'pl'
    primary = HouseholdMember.query.filter_by(user_id=user.id, is_primary=True).first()
    if not primary or primary.name not in ('Me', 'Ja'):
        return False
    expected = default_primary_member_name(lang)
    if primary.name == expected:
        return False
    primary.name = expected
    db.session.commit()
    return True
