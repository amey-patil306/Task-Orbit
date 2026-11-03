from ..extensions import db
from ..utils.dates import iso_date, iso_datetime, utcnow


class WorkloadSnapshot(db.Model):
    """A daily record, kept for charts and as real training data."""

    __tablename__ = "workload_snapshots"
    __table_args__ = (db.UniqueConstraint("user_id", "day", name="uq_workload_snapshots_user_day"),)

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    day = db.Column(db.Date, nullable=False)
    hours_required = db.Column(db.Float, nullable=False)
    hours_available = db.Column(db.Float, nullable=False)
    load_ratio = db.Column(db.Float, nullable=False)
    rule_label = db.Column(db.String(20), nullable=False)
    ml_label = db.Column(db.String(20), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "day": iso_date(self.day),
            "hours_required": self.hours_required,
            "hours_available": self.hours_available,
            "load_ratio": self.load_ratio,
            "rule_label": self.rule_label,
            "ml_label": self.ml_label,
            "created_at": iso_datetime(self.created_at),
        }
