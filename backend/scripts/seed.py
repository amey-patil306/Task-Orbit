"""Create (or reset) a demo account with realistic tasks.

Run from backend/:   .venv\\Scripts\\python scripts\\seed.py
Login:               demo@taskorbit.in  /  demo12345
"""
import sys
from datetime import datetime, time, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app  # noqa: E402
from app.extensions import db  # noqa: E402
from app.models import Subject, Task, User  # noqa: E402
from app.models.availability import default_availability  # noqa: E402
from app.services.alert_service import recompute_alerts  # noqa: E402
from app.utils.dates import LOCAL_OFFSET, local_today  # noqa: E402

DEMO_EMAIL = "demo@taskorbit.in"
DEMO_PASSWORD = "demo12345"

SUBJECTS = [("DBMS", "#6366F1"), ("Operating Systems", "#0EA5E9"), ("Computer Networks", "#10B981"),
            ("Maths III", "#F59E0B"), ("Mini Project", "#EC4899")]

# (title, subject index, type, difficulty, priority, est hours, days from today, hour IST)
TASKS = [
    ("ER diagram assignment", 0, "assignment", 3, 4, 3, 2, 23),
    ("OS practical 5: scheduling", 1, "practical", 3, 3, 2, 3, 17),
    ("CN lab: subnetting", 2, "practical", 2, 3, 2, 3, 17),
    ("Maths III unit test", 3, "exam", 4, 5, 6, 5, 10),
    ("SQL queries worksheet", 0, "assignment", 2, 3, 2, 6, 23),
    ("Mini project: UI mockups", 4, "project", 3, 4, 4, 7, 18),
    ("OS assignment 2: deadlocks", 1, "assignment", 4, 4, 4, 9, 23),
    ("CN mid-sem exam", 2, "exam", 4, 5, 8, 11, 10),
    ("DBMS normalization quiz prep", 0, "exam", 3, 3, 3, 12, 9),
    ("Mini project: backend API", 4, "project", 4, 4, 8, 13, 18),
]
DONE = [  # past tasks with real hours, so the history looks lived-in
    ("Maths III tutorial 4", 3, "assignment", 3, 3, 3, -3, 23, 4.5),
    ("OS practical 4", 1, "practical", 2, 3, 2, -5, 17, 2.5),
]


def due(days: int, hour: int) -> datetime:
    """IST date/time -> naive UTC, the way the API stores it."""
    return datetime.combine(local_today() + timedelta(days=days), time(hour)) - LOCAL_OFFSET


def main():
    app = create_app()
    with app.app_context():
        old = db.session.scalar(db.select(User).where(User.email == DEMO_EMAIL))
        if old:
            db.session.delete(old)
            db.session.commit()

        user = User(name="Demo Student", email=DEMO_EMAIL)
        user.set_password(DEMO_PASSWORD)
        db.session.add(user)
        db.session.flush()
        db.session.add_all(default_availability(user.id))

        subjects = [Subject(user_id=user.id, name=n, colour=c) for n, c in SUBJECTS]
        db.session.add_all(subjects)
        db.session.flush()

        for title, s, kind, diff, prio, hours, days, hour in TASKS:
            db.session.add(Task(user_id=user.id, subject_id=subjects[s].id, title=title, type=kind,
                                difficulty=diff, priority=prio, estimated_hours=hours, due_date=due(days, hour)))
        for title, s, kind, diff, prio, hours, days, hour, actual in DONE:
            db.session.add(Task(user_id=user.id, subject_id=subjects[s].id, title=title, type=kind,
                                difficulty=diff, priority=prio, estimated_hours=hours, due_date=due(days, hour),
                                status="done", actual_hours=actual, completed_at=due(days, hour - 2)))
        db.session.flush()
        recompute_alerts(user.id)
        db.session.commit()
        print(f"Demo account ready: {DEMO_EMAIL} / {DEMO_PASSWORD}")


if __name__ == "__main__":
    main()
