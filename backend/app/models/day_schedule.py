from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DayScheduleBlock(Base):
    __tablename__ = "day_schedule_blocks"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    member_id: Mapped[int] = mapped_column(ForeignKey("household_members.id"), nullable=False)
    week_start: Mapped[date] = mapped_column(Date, nullable=False)
    day: Mapped[int] = mapped_column(Integer, nullable=False)
    start_hour: Mapped[int] = mapped_column(Integer, nullable=False)
    end_hour: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
