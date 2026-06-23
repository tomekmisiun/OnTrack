from sqlalchemy.orm import Session

from app.models.household_member import HouseholdMember


def default_primary_member_name(lang: str) -> str:
    return "Me" if lang == "en" else "Ja"


def ensure_primary_member(session: Session, user_id: int, lang: str) -> None:
    existing = (
        session.query(HouseholdMember)
        .filter_by(user_id=user_id, is_primary=True)
        .first()
    )
    if existing:
        return
    session.add(
        HouseholdMember(
            user_id=user_id,
            name=default_primary_member_name(lang),
            is_primary=True,
        )
    )
    session.commit()


def sync_primary_member_name(session: Session, user) -> bool:
    if not user:
        return False
    lang = user.lang if user.lang in ("pl", "en") else "pl"
    primary = (
        session.query(HouseholdMember)
        .filter_by(user_id=user.id, is_primary=True)
        .first()
    )
    if not primary or primary.name not in ("Me", "Ja"):
        return False
    expected = default_primary_member_name(lang)
    if primary.name == expected:
        return False
    primary.name = expected
    session.commit()
    return True
