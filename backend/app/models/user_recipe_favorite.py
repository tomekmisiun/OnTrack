from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class UserRecipeFavorite(Base):
    __tablename__ = "user_recipe_favorites"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id"), primary_key=True)
