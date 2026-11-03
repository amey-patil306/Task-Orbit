"""Date helpers. Everything is stored as naive UTC; the API emits ISO 8601 with a trailing Z."""
from datetime import date, datetime, timezone


def utcnow() -> datetime:
    """Current time as naive UTC (what we store in the database)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def to_utc_naive(value: datetime) -> datetime:
    """Convert an aware datetime to naive UTC; assume naive input is already UTC."""
    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def iso_datetime(value: datetime | None) -> str | None:
    return None if value is None else value.replace(microsecond=0).isoformat() + "Z"


def iso_date(value: date | None) -> str | None:
    return None if value is None else value.isoformat()
