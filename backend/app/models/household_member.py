from sqlalchemy import Boolean, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class HouseholdMember(Base):
    __tablename__ = "household_members"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    gender: Mapped[str | None] = mapped_column(String(1))
    age: Mapped[int | None] = mapped_column(Integer)
    weight: Mapped[float | None] = mapped_column(Float)
    height: Mapped[float | None] = mapped_column(Float)
    activity: Mapped[float | None] = mapped_column(Float)
    goal: Mapped[str | None] = mapped_column(String(20))
    macro_kcal: Mapped[int | None] = mapped_column(Integer)
    macro_protein: Mapped[int | None] = mapped_column(Integer)
    macro_fat: Mapped[int | None] = mapped_column(Integer)
    macro_carbs: Mapped[int | None] = mapped_column(Integer)
    macro_goal_label: Mapped[str | None] = mapped_column(String(50))
