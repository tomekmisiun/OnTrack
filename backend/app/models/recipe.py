from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Float, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.product import Product

if TYPE_CHECKING:
    from app.models.recipe_translation import RecipeTranslation


class Recipe(Base):
    __tablename__ = "recipes"
    __table_args__ = (
        Index(
            "uq_recipes_catalog_key_system",
            "catalog_key",
            unique=True,
            postgresql_where=text("user_id IS NULL AND catalog_key IS NOT NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="user")
    catalog_key: Mapped[str | None] = mapped_column(String(120), nullable=True)
    user_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(20), nullable=True, default="other")
    servings: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    kcal_100g: Mapped[float | None] = mapped_column(Float, nullable=True, default=0)
    protein_100g: Mapped[float | None] = mapped_column(Float, nullable=True, default=0)
    fat_100g: Mapped[float | None] = mapped_column(Float, nullable=True, default=0)
    carbs_100g: Mapped[float | None] = mapped_column(Float, nullable=True, default=0)
    is_favorite: Mapped[bool] = mapped_column(default=False)

    translations: Mapped[list[RecipeTranslation]] = relationship(
        back_populates="recipe",
        cascade="all, delete-orphan",
    )
    ingredients: Mapped[list[RecipeIngredient]] = relationship(
        back_populates="recipe",
        cascade="all, delete-orphan",
    )


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id: Mapped[int] = mapped_column(primary_key=True)
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False)

    recipe: Mapped[Recipe] = relationship(back_populates="ingredients")
    product: Mapped[Product] = relationship()
