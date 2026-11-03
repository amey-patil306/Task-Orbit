import secrets

from ..extensions import db
from ..utils.dates import iso_datetime, utcnow

# No 0/O/1/I so codes are easy to read out in class.
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def new_join_code() -> str:
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(6))


class Classroom(db.Model):
    """A teacher's class for one subject, e.g. 'DBMS - SE ECE A'."""

    __tablename__ = "classrooms"

    id = db.Column(db.Integer, primary_key=True)
    teacher_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    subject_name = db.Column(db.String(100), nullable=False)
    colour = db.Column(db.String(7), nullable=False, default="#6366F1")
    join_code = db.Column(db.String(8), nullable=False, unique=True, default=new_join_code)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    enrollments = db.relationship("Enrollment", backref="classroom", cascade="all, delete-orphan",
                                  passive_deletes=True, lazy="dynamic")
    assignments = db.relationship("Assignment", backref="classroom", cascade="all, delete-orphan",
                                  passive_deletes=True, lazy="dynamic")

    def student_ids(self) -> list[int]:
        return [e.student_id for e in self.enrollments]

    def to_dict(self, with_counts: bool = False) -> dict:
        data = {
            "id": self.id,
            "name": self.name,
            "subject_name": self.subject_name,
            "colour": self.colour,
            "join_code": self.join_code,
            "teacher_id": self.teacher_id,
            "teacher_name": self.teacher.name if self.teacher else None,
            "created_at": iso_datetime(self.created_at),
        }
        if with_counts:
            data["students_count"] = self.enrollments.count()
            data["assignments_count"] = self.assignments.count()
        return data


class Enrollment(db.Model):
    __tablename__ = "enrollments"
    __table_args__ = (db.UniqueConstraint("classroom_id", "student_id", name="uq_enrollments_class_student"),)

    id = db.Column(db.Integer, primary_key=True)
    classroom_id = db.Column(db.Integer, db.ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    joined_at = db.Column(db.DateTime, nullable=False, default=utcnow)
