from pydantic import BaseModel, Field, RootModel, field_validator


class AvailabilityItem(BaseModel):
    weekday: int = Field(ge=0, le=6)  # Monday = 0 ... Sunday = 6
    hours: float = Field(ge=0, le=24)


class AvailabilityUpdate(RootModel[list[AvailabilityItem]]):
    """PUT body: a list of {weekday, hours}. Weekdays not listed keep their current hours."""

    @field_validator("root")
    @classmethod
    def _unique_weekdays(cls, items: list[AvailabilityItem]) -> list[AvailabilityItem]:
        if not items:
            raise ValueError("send at least one weekday")
        days = [i.weekday for i in items]
        if len(days) != len(set(days)):
            raise ValueError("each weekday may appear only once")
        return items
