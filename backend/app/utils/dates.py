"""Date helpers. Everything is stored as naive UTC; the API emits ISO 8601 with a trailing Z."""
from datetime import date, datetime, timedelta, timezone

# Students are in India (Asia/Kolkata, no daylight saving), so "which day" questions
# - today, which day a deadline falls on - are answered in IST.
LOCAL_OFFSET = timedelta(hours=5, minutes=30)


def local_today() -> date:
    return (utcnow() + LOCAL_OFFSET).date()


def local_day(value: datetime | date) -> date:
    """The IST calendar day of a stored (naive UTC) datetime."""
    if isinstance(value, datetime):
        return (value + LOCAL_OFFSET).date()
    return value


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
