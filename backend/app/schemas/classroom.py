from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from ..utils.dates import to_utc_naive
from .task import TaskType


class _Base(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="ignore")


class ClassroomIn(_Base):
    name: str = Field(min_length=1, max_length=120)            # e.g. "DBMS - SE ECE A"
    subject_name: str = Field(min_length=1, max_length=100)    # e.g. "DBMS"
    colour: str = Field(default="#6366F1", pattern=r"^#[0-9A-Fa-f]{6}$")


class JoinIn(_Base):
    code: str = Field(min_length=4, max_length=8)

    @field_validator("code")
    @classmethod
    def _upper(cls, v: str) -> str:
        return v.upper()


def utc_field(*names):
    """Reusable validator: convert these datetime fields to naive UTC."""
    @field_validator(*names)
    @classmethod
    def _to_utc(cls, v):
        return None if v is None else to_utc_naive(v)
    return _to_utc


class AssignmentIn(_Base):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    type: TaskType = "assignment"
    difficulty: int = Field(default=3, ge=1, le=5)
    expected_hours: float = Field(gt=0, le=200)
    due_date: datetime
    start_date: date | None = None

    utc_dates = utc_field("due_date")

    @model_validator(mode="after")
    def _dates(self):
        if self.start_date and self.start_date > self.due_date.date():
            raise ValueError("start_date must be on or before due_date")
        return self


class AssignmentUpdate(_Base):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    type: TaskType | None = None
    difficulty: int | None = Field(default=None, ge=1, le=5)
    expected_hours: float | None = Field(default=None, gt=0, le=200)
    due_date: datetime | None = None
    start_date: date | None = None

    utc_dates = utc_field("due_date")


class DeadlineCheckIn(_Base):
    expected_hours: float = Field(gt=0, le=200)
    due_date: datetime
    start_date: date | None = None
    exclude_assignment_id: int | None = None  # when editing an existing assignment

    utc_dates = utc_field("due_date")


class ExtensionIn(_Base):
    reason: str = Field(min_length=5, max_length=1000)
    requested_due: datetime

    utc_dates = utc_field("requested_due")


class ExtensionDecision(_Base):
    status: Literal["approved", "rejected"]
    teacher_note: str | None = Field(default=None, max_length=1000)
    new_due: datetime | None = None  # teacher may approve a different date than asked

    utc_dates = utc_field("new_due")


class CheckInIn(_Base):
    stress: int = Field(ge=1, le=5)
    note: str | None = Field(default=None, max_length=500)
