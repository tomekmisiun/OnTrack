from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    username: Mapped[str | None] = mapped_column(String(80), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.utcnow)
    lang: Mapped[str] = mapped_column(String(5), nullable=False, default="pl")
    ui_locale: Mapped[str] = mapped_column(String(5), nullable=False, default="pl")
    market_code: Mapped[str] = mapped_column(
        String(10),
        ForeignKey("markets.code"),
        nullable=False,
        default="PL",
        index=True,
    )
