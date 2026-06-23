from pydantic import BaseModel


class ApplyPricesRequest(BaseModel):
    updates: list[dict]
