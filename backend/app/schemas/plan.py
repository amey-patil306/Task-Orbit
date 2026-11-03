from pydantic import BaseModel, Field


class PlanGenerate(BaseModel):
    horizon_days: int = Field(default=14, ge=1, le=30)


class SessionUpdate(BaseModel):
    done: bool
