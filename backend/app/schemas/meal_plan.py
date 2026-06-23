from pydantic import BaseModel, Field


class AddMealRequest(BaseModel):
    date: str
    position: int = Field(ge=1, le=5)
    recipe_id: int
    member_id: int | None = None


class CopyRangeRequest(BaseModel):
    source_start: str
    source_end: str
    target_start: str
    member_id: int | None = None
