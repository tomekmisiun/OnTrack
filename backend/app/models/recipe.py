from sqlalchemy import Boolean, CheckConstraint, Float, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.product import Product

RECIPE_SOURCES = frozenset({"system", "user"})


class Recipe(Base):
    __tablename__ = "recipes"
    __table_args__ = (
        CheckConstraint(
            "(source = 'system' AND user_id IS NULL) OR "
            "(source != 'system' AND user_id IS NOT NULL)",
            name="ck_recipes_system_user_id",
        ),
        CheckConstraint(
            "source != 'system' OR catalog_key IS NOT NULL",
            name="ck_recipes_system_catalog_key",
        ),
        Index("ix_recipes_market_code", "market_code"),
        Index(
            "uq_recipes_market_catalog_key_system",
            "market_code",
            "catalog_key",
            unique=True,
            postgresql_where=text("user_id IS NULL AND catalog_key IS NOT NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="user")
    catalog_key: Mapped[str | None] = mapped_column(String(120))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    is_favorite: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    image_url: Mapped[str | None] = mapped_column(Text)
    source_url: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(20))
    servings: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    lang: Mapped[str | None] = mapped_column(String(5), default="pl")
    market_code: Mapped[str] = mapped_column(String(10), nullable=False, default="PL")
    kcal_100g: Mapped[float | None] = mapped_column(Float)
    protein_100g: Mapped[float | None] = mapped_column(Float)
    fat_100g: Mapped[float | None] = mapped_column(Float)
    carbs_100g: Mapped[float | None] = mapped_column(Float)

    ingredients: Mapped[list["RecipeIngredient"]] = relationship(
        back_populates="recipe",
        cascade="all, delete-orphan",
    )


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id: Mapped[int] = mapped_column(primary_key=True)
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False)

    recipe: Mapped["Recipe"] = relationship(back_populates="ingredients")
    product: Mapped["Product"] = relationship()
