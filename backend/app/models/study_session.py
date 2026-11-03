from ..extensions import db
from ..utils.dates import iso_date


class StudySession(db.Model):
    """Output of the planner; replaced every time the plan is regenerated."""

    __tablename__ = "study_sessions"
    __table_args__ = (
        db.CheckConstraint("planned_hours > 0", name="planned_hours_positive"),
        db.Index("ix_study_sessions_user_id_planned_date", "user_id", "planned_date"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    task_id = db.Column(db.Integer, db.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    planned_date = db.Column(db.Date, nullable=False)
    planned_hours = db.Column(db.Float, nullable=False)
    done = db.Column(db.Boolean, nullable=False, default=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "task_id": self.task_id,
            "planned_date": iso_date(self.planned_date),
            "planned_hours": self.planned_hours,
            "done": self.done,
        }
