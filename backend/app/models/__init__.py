"""Importing this package registers every model with SQLAlchemy (and Alembic)."""
from .alert import Alert
from .assignment import Assignment
from .availability import Availability
from .checkin import CheckIn
from .classroom import Classroom, Enrollment
from .extension import ExtensionRequest
from .snapshot import WorkloadSnapshot
from .study_session import StudySession
from .subject import Subject
from .task import Task
from .user import User

__all__ = [
    "User", "Subject", "Task", "Availability", "StudySession", "Alert", "WorkloadSnapshot",
    "Classroom", "Enrollment", "Assignment", "ExtensionRequest", "CheckIn",
]
