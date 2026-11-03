from ..extensions import db
from ..models import Availability
from ..models.availability import DEFAULT_HOURS


def availability_rows(user_id: int) -> dict[int, Availability]:
    """All seven rows for a user, adding any missing ones with the defaults (caller commits)."""
    rows = {a.weekday: a for a in db.session.scalars(db.select(Availability).where(Availability.user_id == user_id))}
    for weekday, hours in DEFAULT_HOURS.items():
        if weekday not in rows:
            rows[weekday] = Availability(user_id=user_id, weekday=weekday, hours=hours)
            db.session.add(rows[weekday])
    return rows


def availability_map(user_id: int) -> dict[int, float]:
    """weekday (Mon=0) -> study hours, for the workload engine."""
    rows = {a.weekday: a.hours for a in db.session.scalars(db.select(Availability).where(Availability.user_id == user_id))}
    return {d: rows.get(d, h) for d, h in DEFAULT_HOURS.items()}
