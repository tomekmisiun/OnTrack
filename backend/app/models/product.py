from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Float, ForeignKey, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.product_market_price import ProductMarketPrice
    from app.models.product_translation import ProductTranslation


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        Index(
            "uq_products_catalog_key_system",
            "catalog_key",
            unique=True,
            postgresql_where=text("user_id IS NULL AND catalog_key IS NOT NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="user")
    catalog_key: Mapped[str | None] = mapped_column(String(120), nullable=True)
    base_product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id"), nullable=True)
    user_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    normalized_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    kcal: Mapped[float | None] = mapped_column(Float, nullable=True)
    protein: Mapped[float | None] = mapped_column(Float, nullable=True)
    fat: Mapped[float | None] = mapped_column(Float, nullable=True)
    carbs: Mapped[float | None] = mapped_column(Float, nullable=True)
    sort_index: Mapped[int | None] = mapped_column(Integer, nullable=True)

    translations: Mapped[list[ProductTranslation]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
    )
    market_prices: Mapped[list[ProductMarketPrice]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
    )

    @property
    def is_system(self) -> bool:
        return self.user_id is None and self.source == "system"

    @property
    def is_user_owned(self) -> bool:
        return self.user_id is not None
