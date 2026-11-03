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
        db.UniqueConstraint("user_id", "assignment_id", name="uq_tasks_user_assignment"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True)
    # Set when the task came from a teacher's assignment (PLAN_V2 section 4).
    assignment_id = db.Column(db.Integer, db.ForeignKey("assignments.id", ondelete="CASCADE"), nullable=True, index=True)
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

    @property
    def is_late(self) -> bool:
        return self.status == "done" and self.completed_at is not None and self.completed_at > self.due_date

    def to_dict(self) -> dict:
        source = None
        if self.assignment_id and self.assignment:
            classroom = self.assignment.classroom
            source = {
                "assignment_id": self.assignment_id,
                "classroom_id": classroom.id,
                "classroom_name": classroom.name,
                "subject_name": classroom.subject_name,
                "colour": classroom.colour,
                "teacher_name": classroom.teacher.name if classroom.teacher else None,
                "expected_hours": self.assignment.expected_hours,
                "original_due_date": iso_datetime(self.assignment.due_date),
            }
        return {
            "id": self.id,
            "subject_id": self.subject_id,
            "from_teacher": source,
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
