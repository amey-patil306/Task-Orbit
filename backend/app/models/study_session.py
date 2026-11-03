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
            # Task details so the planner screen can show sessions without extra requests.
            "task_title": self.task.title if self.task else None,
            "task_type": self.task.type if self.task else None,
            "subject_id": self.task.subject_id if self.task else None,
            "class_colour": self.task.assignment.classroom.colour if self.task and self.task.assignment else None,
            "class_name": self.task.assignment.classroom.subject_name if self.task and self.task.assignment else None,
        }
