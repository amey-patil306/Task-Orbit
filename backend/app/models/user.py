from werkzeug.security import check_password_hash, generate_password_hash

from ..extensions import db
from ..utils.dates import iso_datetime, utcnow

_owned = {"cascade": "all, delete-orphan", "passive_deletes": True, "lazy": "dynamic"}


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(255), nullable=False, unique=True, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.Enum("student", "teacher", name="user_role", native_enum=False, create_constraint=True),
                     nullable=False, default="student")
    department = db.Column(db.String(100), nullable=True)
    year = db.Column(db.String(20), nullable=True)       # e.g. "SE"
    division = db.Column(db.String(20), nullable=True)   # e.g. "A"
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    # Deleting a user cascades to everything they own (section 7).
    subjects = db.relationship("Subject", backref="user", **_owned)
    tasks = db.relationship("Task", backref="user", **_owned)
    availability = db.relationship("Availability", backref="user", **_owned)
    study_sessions = db.relationship("StudySession", backref="user", **_owned)
    alerts = db.relationship("Alert", backref="user", **_owned)
    workload_snapshots = db.relationship("WorkloadSnapshot", backref="user", **_owned)
    checkins = db.relationship("CheckIn", backref="user", **_owned)
    classrooms_taught = db.relationship("Classroom", backref="teacher", **_owned)
    enrollments = db.relationship("Enrollment", backref="student", **_owned)

    @property
    def is_teacher(self) -> bool:
        return self.role == "teacher"

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "department": self.department,
            "year": self.year,
            "division": self.division,
            "created_at": iso_datetime(self.created_at),
        }
