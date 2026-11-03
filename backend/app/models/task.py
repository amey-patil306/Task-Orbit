from ..extensions import db
from ..utils.dates import iso_date, iso_datetime, utcnow

TASK_TYPES = ("assignment", "practical", "exam", "project", "other")
TASK_STATUSES = ("todo", "in_progress", "done")


class Task(db.Model):
    __tablename__ = "tasks"
    __table_args__ = (
        db.CheckConstraint("difficulty BETWEEN 1 AND 5", name="difficulty_range"),
        db.CheckConstraint("priority BETWEEN 1 AND 5", name="priority_range"),
        db.CheckConstraint("estimated_hours > 0", name="estimated_hours_positive"),
        db.CheckConstraint("actual_hours IS NULL OR actual_hours >= 0", name="actual_hours_non_negative"),
        db.Index("ix_tasks_user_id_due_date", "user_id", "due_date"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    type = db.Column(
        db.Enum(*TASK_TYPES, name="task_type", native_enum=False, create_constraint=True),
        nullable=False,
        default="assignment",
    )
    difficulty = db.Column(db.Integer, nullable=False, default=3)
    priority = db.Column(db.Integer, nullable=False, default=3)
    estimated_hours = db.Column(db.Float, nullable=False)
    actual_hours = db.Column(db.Float, nullable=True)  # ML target, asked for on completion
    start_date = db.Column(db.Date, nullable=True)
    due_date = db.Column(db.DateTime, nullable=False)  # naive UTC
    status = db.Column(
        db.Enum(*TASK_STATUSES, name="task_status", native_enum=False, create_constraint=True),
        nullable=False,
        default="todo",
    )
    completed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    study_sessions = db.relationship(
        "StudySession", backref="task", cascade="all, delete-orphan", passive_deletes=True, lazy="dynamic"
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "subject_id": self.subject_id,
            "title": self.title,
            "description": self.description,
            "type": self.type,
            "difficulty": self.difficulty,
            "priority": self.priority,
            "estimated_hours": self.estimated_hours,
            "actual_hours": self.actual_hours,
            "start_date": iso_date(self.start_date),
            "due_date": iso_datetime(self.due_date),
            "status": self.status,
            "completed_at": iso_datetime(self.completed_at),
            "created_at": iso_datetime(self.created_at),
        }
