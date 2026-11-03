from ..extensions import db
from ..utils.dates import iso_date, iso_datetime, utcnow


class CheckIn(db.Model):
    """Weekly 'How overloaded did you feel? 1-5'. Shown as a trend and used as a real ML label."""

    __tablename__ = "checkins"
    __table_args__ = (
        db.UniqueConstraint("user_id", "week_start", name="uq_checkins_user_week"),
        db.CheckConstraint("stress BETWEEN 1 AND 5", name="stress_range"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    week_start = db.Column(db.Date, nullable=False)  # Monday of the week
    stress = db.Column(db.Integer, nullable=False)
    note = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "week_start": iso_date(self.week_start),
            "stress": self.stress,
            "note": self.note,
            "created_at": iso_datetime(self.created_at),
        }
