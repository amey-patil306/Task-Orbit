from ..extensions import db

# Python's date.weekday(): Monday = 0 ... Sunday = 6.
DEFAULT_HOURS = {0: 3.0, 1: 3.0, 2: 3.0, 3: 3.0, 4: 3.0, 5: 5.0, 6: 5.0}


class Availability(db.Model):
    __tablename__ = "availability"
    __table_args__ = (
        db.UniqueConstraint("user_id", "weekday", name="uq_availability_user_weekday"),
        db.CheckConstraint("weekday BETWEEN 0 AND 6", name="weekday_range"),
        db.CheckConstraint("hours >= 0 AND hours <= 24", name="hours_range"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    weekday = db.Column(db.Integer, nullable=False)
    hours = db.Column(db.Float, nullable=False)

    def to_dict(self) -> dict:
        return {"weekday": self.weekday, "hours": self.hours}


def default_availability(user_id: int) -> list[Availability]:
    """Default: 3 hours on weekdays, 5 on weekends (section 7)."""
    return [Availability(user_id=user_id, weekday=d, hours=h) for d, h in DEFAULT_HOURS.items()]
