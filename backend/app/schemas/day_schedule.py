from pydantic import BaseModel


class CreateBlockRequest(BaseModel):
    week_start: str
    day: int
    start_hour: int
    end_hour: int
    label: str
    member_id: int | None = None


class CreateBulkRequest(BaseModel):
    week_start: str
    start_hour: int
    end_hour: int
    label: str
    days: list[int]
    member_id: int | None = None


class UpdateBlockRequest(BaseModel):
    start_hour: int | None = None
    end_hour: int | None = None
    label: str | None = None
