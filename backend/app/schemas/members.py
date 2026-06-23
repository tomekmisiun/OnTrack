from pydantic import BaseModel, Field


class MemberNameRequest(BaseModel):
    name: str = ""


class MemberProfileRequest(BaseModel):
    gender: str | None = None
    age: int | None = None
    weight: float | None = None
    height: float | None = None
    activity: float | None = None
    goal: str | None = None
    macro_kcal: int | None = None
    macro_protein: int | None = None
    macro_fat: int | None = None
    macro_carbs: int | None = None
    macro_goal_label: str | None = Field(default=None, max_length=50)

    model_config = {"extra": "ignore"}
