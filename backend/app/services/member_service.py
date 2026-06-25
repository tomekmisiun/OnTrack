from sqlalchemy.orm import Session

from app.models.household_member import HouseholdMember
from app.services.member_presenter import member_to_dict

MAX_MEMBERS = 10
MAX_NAME = 80


class MemberServiceError(Exception):
    def __init__(self, message: str, status_code: int):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


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
    locale = (
        user.ui_locale
        if getattr(user, "ui_locale", None) in ("pl", "en")
        else "pl"
    )
    primary = (
        session.query(HouseholdMember)
        .filter_by(user_id=user.id, is_primary=True)
        .first()
    )
    if not primary or primary.name not in ("Me", "Ja"):
        return False
    expected = default_primary_member_name(locale)
    if primary.name == expected:
        return False
    primary.name = expected
    session.commit()
    return True


def _get_own_member(session: Session, user_id: int, member_id: int) -> HouseholdMember:
    member = (
        session.query(HouseholdMember)
        .filter_by(id=member_id, user_id=user_id)
        .first()
    )
    if not member:
        raise MemberServiceError("Member not found", 404)
    return member


def list_members(session: Session, user_id: int) -> list[dict]:
    members = (
        session.query(HouseholdMember)
        .filter_by(user_id=user_id)
        .order_by(HouseholdMember.id)
        .all()
    )
    return [member_to_dict(m) for m in members]


def create_member(session: Session, user_id: int, name: str) -> dict:
    if session.query(HouseholdMember).filter_by(user_id=user_id).count() >= MAX_MEMBERS:
        raise MemberServiceError(f"Maximum number of members: {MAX_MEMBERS}", 400)

    name = name.strip()[:MAX_NAME]
    if not name:
        raise MemberServiceError("Name is required", 400)

    member = HouseholdMember(user_id=user_id, name=name, is_primary=False)
    session.add(member)
    session.commit()
    session.refresh(member)
    return member_to_dict(member)


def rename_member(session: Session, user_id: int, member_id: int, name: str) -> dict:
    member = _get_own_member(session, user_id, member_id)
    name = name.strip()[:MAX_NAME]
    if not name:
        raise MemberServiceError("Name is required", 400)
    member.name = name
    session.commit()
    session.refresh(member)
    return member_to_dict(member)


def delete_member(session: Session, user_id: int, member_id: int) -> None:
    member = _get_own_member(session, user_id, member_id)
    if member.is_primary:
        raise MemberServiceError("Cannot delete the primary member", 403)
    session.delete(member)
    session.commit()


def save_profile(session: Session, user_id: int, member_id: int, data: dict) -> dict:
    member = _get_own_member(session, user_id, member_id)

    for field in ("gender", "activity", "goal"):
        if field in data:
            setattr(member, field, data[field])

    for field in (
        "age",
        "weight",
        "height",
        "macro_kcal",
        "macro_protein",
        "macro_fat",
        "macro_carbs",
    ):
        if field in data and data[field] is not None:
            try:
                value = (
                    int(data[field])
                    if field
                    in ("age", "macro_kcal", "macro_protein", "macro_fat", "macro_carbs")
                    else float(data[field])
                )
                setattr(member, field, value)
            except (TypeError, ValueError):
                pass

    if "macro_goal_label" in data:
        member.macro_goal_label = str(data["macro_goal_label"])[:50]

    session.commit()
    session.refresh(member)
    return member_to_dict(member)
