from pydantic import BaseModel, Field


class RecipeIngredientInput(BaseModel):
    product_id: int
    weight: float


class RecipeCreateRequest(BaseModel):
    name: str
    notes: str | None = None
    category: str | None = None
    servings: int = 0
    ingredients: list[RecipeIngredientInput] = Field(default_factory=list)


class RecipeUpdateRequest(BaseModel):
    name: str | None = None
    notes: str | None = None
    category: str | None = None
    ingredients: list[RecipeIngredientInput] | None = None

    model_config = {"extra": "ignore"}


class RecipeCategoryRequest(BaseModel):
    category: str | None = None
