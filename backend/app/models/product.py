from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Float,
    ForeignKey,
    Index,
    String,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

PRODUCT_SOURCES = frozenset({"system", "user", "import", "legacy"})


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint(
            "(source = 'system' AND user_id IS NULL) OR "
            "(source != 'system' AND user_id IS NOT NULL)",
            name="ck_products_system_user_id",
        ),
        CheckConstraint(
            "source != 'system' OR catalog_key IS NOT NULL",
            name="ck_products_system_catalog_key",
        ),
        Index("ix_products_user_id_lang", "user_id", "lang"),
        Index("ix_products_lang_normalized_name", "lang", "normalized_name"),
        Index("ix_products_market_code", "market_code"),
        Index(
            "uq_products_lang_catalog_key_system",
            "lang",
            "catalog_key",
            unique=True,
            postgresql_where=text("user_id IS NULL AND catalog_key IS NOT NULL"),
        ),
        Index(
            "uq_products_market_catalog_key_system",
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
    base_product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id"))
    normalized_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    package_weight: Mapped[float] = mapped_column(Float, nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(10), nullable=False, default="g")
    kcal: Mapped[float | None] = mapped_column(Float)
    protein: Mapped[float | None] = mapped_column(Float)
    fat: Mapped[float | None] = mapped_column(Float)
    carbs: Mapped[float | None] = mapped_column(Float)
    sold_by_weight: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    lang: Mapped[str | None] = mapped_column(String(5), default="pl")
    market_code: Mapped[str] = mapped_column(String(10), nullable=False, default="PL")
