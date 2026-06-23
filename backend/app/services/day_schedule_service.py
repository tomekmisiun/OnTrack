from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models.day_schedule import DayScheduleBlock
from app.models.household_member import HouseholdMember
from app.services.day_schedule_presenter import block_to_dict


class DayScheduleServiceError(Exception):
    def __init__(self, message: str, status_code: int):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def parse_week_start(value: str | None) -> date | None:
    if not value:
        return None
    try:
        d = date.fromisoformat(value)
    except ValueError:
        return None
    return d - timedelta(days=d.weekday())


def resolve_member_id(
    session: Session, user_id: int, member_id: int | str | None = None
) -> int | None:
    if member_id is not None:
        member = (
            session.query(HouseholdMember)
            .filter_by(id=int(member_id), user_id=user_id)
            .first()
        )
        if member:
            return member.id
    primary = (
        session.query(HouseholdMember)
        .filter_by(user_id=user_id, is_primary=True)
        .first()
    )
    return primary.id if primary else None


def _validate_hours(start_hour: int, end_hour: int) -> bool:
    if not (0 <= start_hour <= 23):
        return False
    if not (1 <= end_hour <= 24) or end_hour <= start_hour:
        return False
    return True


def _has_overlap(
    session: Session,
    user_id: int,
    member_id: int,
    week_start: date,
    day: int,
    start_hour: int,
    end_hour: int,
    *,
    exclude_id: int | None = None,
) -> bool:
    query = session.query(DayScheduleBlock).filter(
        DayScheduleBlock.user_id == user_id,
        DayScheduleBlock.member_id == member_id,
        DayScheduleBlock.week_start == week_start,
        DayScheduleBlock.day == day,
        DayScheduleBlock.start_hour < end_hour,
        DayScheduleBlock.end_hour > start_hour,
    )
    if exclude_id is not None:
        query = query.filter(DayScheduleBlock.id != exclude_id)
    return query.first() is not None


def get_blocks(
    session: Session,
    user_id: int,
    *,
    member_id: int | str | None,
    week_start_raw: str | None,
) -> list[dict]:
    mid = resolve_member_id(session, user_id, member_id)
    if not mid:
        return []

    week_start = parse_week_start(week_start_raw)
    if not week_start:
        raise DayScheduleServiceError("Invalid or missing week_start", 400)

    blocks = (
        session.query(DayScheduleBlock)
        .filter_by(user_id=user_id, member_id=mid, week_start=week_start)
        .order_by(DayScheduleBlock.day, DayScheduleBlock.start_hour)
        .all()
    )
    return [block_to_dict(b) for b in blocks]


def create_block(
    session: Session,
    user_id: int,
    *,
    week_start_raw: str | None,
    day: int,
    start_hour: int,
    end_hour: int,
    label: str,
    member_id: int | None = None,
) -> dict:
    week_start = parse_week_start(week_start_raw)
    if not week_start:
        raise DayScheduleServiceError("Invalid or missing week_start", 400)

    label = label.strip()
    if not label:
        raise DayScheduleServiceError("Label is required", 400)
    if not (0 <= day <= 6):
        raise DayScheduleServiceError("Day must be 0–6", 400)
    if not _validate_hours(start_hour, end_hour):
        raise DayScheduleServiceError("Invalid hour range", 400)

    mid = resolve_member_id(session, user_id, member_id)
    if not mid:
        raise DayScheduleServiceError("Member not found", 404)

    if _has_overlap(session, user_id, mid, week_start, day, start_hour, end_hour):
        raise DayScheduleServiceError("Overlapping activity", 409)

    block = DayScheduleBlock(
        user_id=user_id,
        member_id=mid,
        week_start=week_start,
        day=day,
        start_hour=start_hour,
        end_hour=end_hour,
        label=label[:120],
    )
    session.add(block)
    session.commit()
    session.refresh(block)
    return block_to_dict(block)


def create_bulk(
    session: Session,
    user_id: int,
    *,
    week_start_raw: str | None,
    days: list[int],
    start_hour: int,
    end_hour: int,
    label: str,
    member_id: int | None = None,
) -> tuple[dict, int]:
    week_start = parse_week_start(week_start_raw)
    if not week_start:
        raise DayScheduleServiceError("Invalid or missing week_start", 400)

    label = label.strip()
    if not label:
        raise DayScheduleServiceError("Label is required", 400)
    if not _validate_hours(start_hour, end_hour):
        raise DayScheduleServiceError("Invalid hour range", 400)
    if not days or any(d < 0 or d > 6 for d in days):
        raise DayScheduleServiceError("Invalid days", 400)

    mid = resolve_member_id(session, user_id, member_id)
    if not mid:
        raise DayScheduleServiceError("Member not found", 404)

    created: list[DayScheduleBlock] = []
    skipped: list[int] = []
    for day in sorted(set(days)):
        if _has_overlap(session, user_id, mid, week_start, day, start_hour, end_hour):
            skipped.append(day)
            continue
        block = DayScheduleBlock(
            user_id=user_id,
            member_id=mid,
            week_start=week_start,
            day=day,
            start_hour=start_hour,
            end_hour=end_hour,
            label=label[:120],
        )
        session.add(block)
        created.append(block)

    if created:
        session.commit()
        for block in created:
            session.refresh(block)
        return {
            "created": [block_to_dict(b) for b in created],
            "skipped": skipped,
        }, 201

    return {"created": [], "skipped": skipped}, 200


def delete_week_blocks(
    session: Session,
    user_id: int,
    *,
    member_id: int | str | None,
    week_start_raw: str | None,
) -> dict:
    mid = resolve_member_id(session, user_id, member_id)
    if not mid:
        raise DayScheduleServiceError("Member not found", 404)

    week_start = parse_week_start(week_start_raw)
    if not week_start:
        raise DayScheduleServiceError("Invalid or missing week_start", 400)

    deleted = (
        session.query(DayScheduleBlock)
        .filter_by(user_id=user_id, member_id=mid, week_start=week_start)
        .delete()
    )
    session.commit()
    return {"ok": True, "deleted": deleted}


def update_block(
    session: Session,
    user_id: int,
    block_id: int,
    *,
    start_hour: int | None = None,
    end_hour: int | None = None,
    label: str | None = None,
) -> dict:
    block = (
        session.query(DayScheduleBlock)
        .filter_by(id=block_id, user_id=user_id)
        .first()
    )
    if not block:
        raise DayScheduleServiceError("Not found", 404)

    new_start = block.start_hour
    new_end = block.end_hour
    if start_hour is not None or end_hour is not None:
        new_start = start_hour if start_hour is not None else block.start_hour
        new_end = end_hour if end_hour is not None else block.end_hour
        if not _validate_hours(new_start, new_end):
            raise DayScheduleServiceError("Invalid hour range", 400)
        if _has_overlap(
            session,
            user_id,
            block.member_id,
            block.week_start,
            block.day,
            new_start,
            new_end,
            exclude_id=block_id,
        ):
            raise DayScheduleServiceError("Overlapping activity", 409)
        block.start_hour = new_start
        block.end_hour = new_end

    if label is not None:
        cleaned = label.strip()
        if not cleaned:
            raise DayScheduleServiceError("Label is required", 400)
        block.label = cleaned[:120]

    session.commit()
    session.refresh(block)
    return block_to_dict(block)


def delete_block(session: Session, user_id: int, block_id: int) -> dict:
    block = (
        session.query(DayScheduleBlock)
        .filter_by(id=block_id, user_id=user_id)
        .first()
    )
    if not block:
        raise DayScheduleServiceError("Not found", 404)

    session.delete(block)
    session.commit()
    return {"ok": True}
