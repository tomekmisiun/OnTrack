from pydantic import BaseModel


class ProductCreateRequest(BaseModel):
    name: str
    package_weight: float
    price: float
    unit: str = "g"
    kcal: float | None = None
    protein: float | None = None
    fat: float | None = None
    carbs: float | None = None
    sold_by_weight: bool = False


class ProductUpdateRequest(BaseModel):
    name: str | None = None
    package_weight: float | None = None
    price: float | None = None
    unit: str | None = None
    kcal: float | None = None
    protein: float | None = None
    fat: float | None = None
    carbs: float | None = None
    sold_by_weight: bool | None = None

    model_config = {"extra": "ignore"}
