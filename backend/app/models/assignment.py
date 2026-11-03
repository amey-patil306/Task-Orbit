from ..extensions import db
from ..utils.dates import iso_date, iso_datetime, utcnow
from .task import TASK_TYPES


class Assignment(db.Model):
    """Work a teacher sets for a whole class. Each enrolled student gets their own Task copy."""

    __tablename__ = "assignments"
    __table_args__ = (
        db.CheckConstraint("difficulty BETWEEN 1 AND 5", name="difficulty_range"),
        db.CheckConstraint("expected_hours > 0", name="expected_hours_positive"),
        db.Index("ix_assignments_classroom_id_due_date", "classroom_id", "due_date"),
    )

    id = db.Column(db.Integer, primary_key=True)
    classroom_id = db.Column(db.Integer, db.ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=False)
    teacher_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    type = db.Column(db.Enum(*TASK_TYPES, name="assignment_type", native_enum=False, create_constraint=True),
                     nullable=False, default="assignment")
    difficulty = db.Column(db.Integer, nullable=False, default=3)
    expected_hours = db.Column(db.Float, nullable=False)
    start_date = db.Column(db.Date, nullable=True)
    due_date = db.Column(db.DateTime, nullable=False)  # naive UTC
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    tasks = db.relationship("Task", backref="assignment", cascade="all, delete-orphan",
                            passive_deletes=True, lazy="dynamic")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "classroom_id": self.classroom_id,
            "title": self.title,
            "description": self.description,
            "type": self.type,
            "difficulty": self.difficulty,
            "expected_hours": self.expected_hours,
            "start_date": iso_date(self.start_date),
            "due_date": iso_datetime(self.due_date),
            "created_at": iso_datetime(self.created_at),
        }
