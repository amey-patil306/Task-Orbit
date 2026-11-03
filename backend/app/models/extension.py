import json

from ..extensions import db
from ..utils.dates import iso_datetime, utcnow

EXTENSION_STATUSES = ("pending", "approved", "rejected")


class ExtensionRequest(db.Model):
    """A student's request for more time on a teacher task, with workload evidence attached."""

    __tablename__ = "extension_requests"

    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    assignment_id = db.Column(db.Integer, db.ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    reason = db.Column(db.String(1000), nullable=False)
    requested_due = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.Enum(*EXTENSION_STATUSES, name="extension_status", native_enum=False, create_constraint=True),
                       nullable=False, default="pending")
    evidence = db.Column(db.Text, nullable=True)  # JSON snapshot of the student's workload
    teacher_note = db.Column(db.String(1000), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    decided_at = db.Column(db.DateTime, nullable=True)

    task = db.relationship("Task")
    assignment = db.relationship("Assignment")
    student = db.relationship("User")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "task_id": self.task_id,
            "assignment_id": self.assignment_id,
            "assignment_title": self.assignment.title if self.assignment else None,
            "classroom_name": self.assignment.classroom.name if self.assignment else None,
            "student_id": self.student_id,
            "student_name": self.student.name if self.student else None,
            "reason": self.reason,
            "current_due": iso_datetime(self.task.due_date) if self.task else None,
            "requested_due": iso_datetime(self.requested_due),
            "status": self.status,
            "evidence": json.loads(self.evidence) if self.evidence else None,
            "teacher_note": self.teacher_note,
            "created_at": iso_datetime(self.created_at),
            "decided_at": iso_datetime(self.decided_at),
        }
