from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from ..utils.dates import to_utc_naive

TaskType = Literal["assignment", "practical", "exam", "project", "other"]
TaskStatus = Literal["todo", "in_progress", "done"]


class _TaskFields(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="ignore")

    @field_validator("due_date", check_fields=False)
    @classmethod
    def _utc(cls, v):
        return None if v is None else to_utc_naive(v)


def _check_dates(start_date: date | None, due_date: datetime | None):
    if start_date and due_date and start_date > due_date.date():
        raise ValueError("start_date must be on or before due_date")


class TaskCreate(_TaskFields):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    type: TaskType = "assignment"
    subject_id: int | None = None
    difficulty: int = Field(default=3, ge=1, le=5)
    priority: int = Field(default=3, ge=1, le=5)
    estimated_hours: float = Field(gt=0, le=500)
    due_date: datetime
    start_date: date | None = None
    status: TaskStatus = "todo"

    @model_validator(mode="after")
    def _dates(self):
        _check_dates(self.start_date, self.due_date)
        return self


class TaskUpdate(_TaskFields):
    """PUT accepts any task field; only the fields sent are changed."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    type: TaskType | None = None
    subject_id: int | None = None
    difficulty: int | None = Field(default=None, ge=1, le=5)
    priority: int | None = Field(default=None, ge=1, le=5)
    estimated_hours: float | None = Field(default=None, gt=0, le=500)
    due_date: datetime | None = None
    start_date: date | None = None
    status: TaskStatus | None = None

    @model_validator(mode="after")
    def _not_null(self):
        # These columns are NOT NULL; only description, subject_id and start_date may be cleared.
        for name in ("title", "type", "difficulty", "priority", "estimated_hours", "due_date", "status"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self


class TaskComplete(BaseModel):
    actual_hours: float = Field(gt=0, le=500)


class TaskQuery(BaseModel):
    """Query-string filters for GET /api/tasks. `from`/`to` filter on due date (inclusive)."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    status: TaskStatus | None = None
    type: TaskType | None = None
    subject_id: int | None = None
    from_: date | None = Field(default=None, alias="from")
    to: date | None = None

    @model_validator(mode="after")
    def _range(self):
        if self.from_ and self.to and self.from_ > self.to:
            raise ValueError("from must be on or before to")
        return self
