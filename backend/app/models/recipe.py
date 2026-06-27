from sqlalchemy import Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Recipe(Base):
    __tablename__ = "recipes"
    __table_args__ = (
        UniqueConstraint("catalog_key", name="uq_recipes_catalog_key"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="user")
    catalog_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    user_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="other")
    servings: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    image_url: Mapped[str | None] = mapped_column(String(500))
    source_url: Mapped[str | None] = mapped_column(String(500))
    kcal_100g: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    protein_100g: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    fat_100g: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    carbs_100g: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    is_favorite: Mapped[bool] = mapped_column(default=False)

    translations: Mapped[list["RecipeTranslation"]] = relationship(
        back_populates="recipe",
        cascade="all, delete-orphan",
    )
    ingredients: Mapped[list["RecipeIngredient"]] = relationship(
        back_populates="recipe",
        cascade="all, delete-orphan",
    )


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id: Mapped[int] = mapped_column(primary_key=True)
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(10), nullable=False, default="g")

    recipe: Mapped["Recipe"] = relationship(back_populates="ingredients")
    product: Mapped["Product"] = relationship()
