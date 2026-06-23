from app.models.day_schedule import DayScheduleBlock


def block_to_dict(block: DayScheduleBlock) -> dict:
    return {
        "id": block.id,
        "member_id": block.member_id,
        "week_start": block.week_start.isoformat(),
        "day": block.day,
        "start_hour": block.start_hour,
        "end_hour": block.end_hour,
        "label": block.label,
    }
