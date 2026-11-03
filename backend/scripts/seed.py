"""Reset the database and fill it with a realistic demo (PLAN_V2).

Run from backend/:   .venv\\Scripts\\python scripts\\seed.py

Accounts (password for all: demo12345)
  Teacher (DBMS + OS):  teacher@taskorbit.in
  Teacher (CN):         cn.teacher@taskorbit.in
  Student (demo):       demo@taskorbit.in
  Students:             student01@taskorbit.in ... student29@taskorbit.in

Each student has a hidden "speed" (how much longer than expected they really take), which
drives their actual hours, late submissions and stress, so the analytics show real patterns.
"""
import json
import random
import sys
from datetime import datetime, time, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app  # noqa: E402
from app.extensions import db  # noqa: E402
from app.models import (Assignment, CheckIn, Classroom, Enrollment, ExtensionRequest, Subject,  # noqa: E402
                        Task, User)
from app.models.availability import default_availability  # noqa: E402
from app.services.alert_service import recompute_alerts  # noqa: E402
from app.services.analytics import extension_evidence  # noqa: E402
from app.services.class_service import push_assignment  # noqa: E402
from app.utils.dates import LOCAL_OFFSET, local_today  # noqa: E402

PASSWORD = "demo12345"
rng = random.Random(42)
TODAY = local_today()

FIRST = ["Aarav", "Diya", "Rohan", "Sneha", "Aditya", "Pooja", "Kunal", "Isha", "Omkar", "Neha", "Siddharth",
         "Prachi", "Yash", "Riya", "Tejas", "Shruti", "Varun", "Anjali", "Harsh", "Komal", "Saurabh", "Madhuri",
         "Nikhil", "Tanvi", "Pratik", "Gauri", "Akash", "Rutuja", "Vedant"]
LAST = ["Patil", "Kulkarni", "Deshmukh", "Joshi", "Pawar", "Shinde", "Jadhav", "More", "Gaikwad", "Kale",
        "Chavan", "Bhosale", "Sawant", "Mane", "Thorat"]


def at(days: int, hour: int) -> datetime:
    """IST day offset + hour -> naive UTC (how the API stores datetimes)."""
    return datetime.combine(TODAY + timedelta(days=days), time(hour)) - LOCAL_OFFSET


def make_user(name, email, role="student", **extra):
    u = User(name=name, email=email, role=role, department="Electronics & Computer", **extra)
    u.set_password(PASSWORD)
    db.session.add(u)
    db.session.flush()
    if role == "student":
        rows = default_availability(u.id)
        weekday, weekend = rng.choice([3, 4, 4, 4, 5]), rng.choice([5, 6, 6, 7])
        for r in rows:
            r.hours = weekday if r.weekday < 5 else weekend
        db.session.add_all(rows)
    return u


def main():
    app = create_app()
    with app.app_context():
        db.drop_all()
        db.create_all()

        # ---------------- people
        t1 = make_user("Prof. Sana Metkari", "teacher@taskorbit.in", "teacher")
        t2 = make_user("Prof. Rahul Deshpande", "cn.teacher@taskorbit.in", "teacher")
        demo = make_user("Demo Student", "demo@taskorbit.in", year="SE", division="A")
        students = [demo] + [
            make_user(f"{FIRST[i]} {rng.choice(LAST)}", f"student{i + 1:02d}@taskorbit.in", year="SE", division="A")
            for i in range(29)]
        # Hidden speed: actual hours / expected. Most ~1.1, a few struggle a lot.
        speed = {s.id: max(0.7, rng.gauss(1.15, 0.25)) for s in students}
        speed[demo.id] = 1.3
        for s in rng.sample(students[1:], 4):
            speed[s.id] = rng.uniform(1.7, 2.1)  # the "at risk" group

        # ---------------- classes (all SE ECE A, three subjects, two teachers)
        dbms = Classroom(teacher_id=t1.id, name="DBMS - SE ECE A", subject_name="DBMS", colour="#6366F1", join_code="DBMS4A")
        os_ = Classroom(teacher_id=t1.id, name="Operating Systems - SE ECE A", subject_name="Operating Systems",
                        colour="#0EA5E9", join_code="OSYS4A")
        cn = Classroom(teacher_id=t2.id, name="Computer Networks - SE ECE A", subject_name="Computer Networks",
                       colour="#10B981", join_code="CNET4A")
        db.session.add_all([dbms, os_, cn])
        db.session.flush()
        for c in (dbms, os_, cn):
            db.session.add_all(Enrollment(classroom_id=c.id, student_id=s.id) for s in students)
        db.session.flush()

        # ---------------- past assignments (history for analytics)
        past = [
            (dbms, "SQL basics worksheet", "assignment", 2, 3, -20),
            (dbms, "ER modelling assignment", "assignment", 3, 4, -12),
            (os_, "Process scheduling practical", "practical", 3, 3, -16),
            (os_, "Shell scripting lab", "practical", 2, 2, -8),
            (cn, "OSI model assignment", "assignment", 2, 3, -18),
            (cn, "Packet tracer lab 1", "practical", 3, 3, -9),
        ]
        for c, title, kind, diff, hours, due_days in past:
            a = Assignment(classroom_id=c.id, teacher_id=c.teacher_id, title=title, type=kind, difficulty=diff,
                           expected_hours=hours, due_date=at(due_days, 23), created_at=at(due_days - 7, 10))
            db.session.add(a)
            db.session.flush()
            push_assignment(a, announce=False)
            for task in a.tasks:
                sp = speed[task.user_id]
                task.status = "done"
                task.estimated_hours = round(hours * rng.uniform(0.8, 1.1) * 2) / 2
                task.actual_hours = round(hours * sp * rng.uniform(0.85, 1.15) * 2) / 2
                late = rng.random() < (0.55 if sp > 1.6 else 0.12 if sp > 1.25 else 0.04)
                task.completed_at = at(due_days + (rng.randint(1, 3) if late else -rng.randint(0, 3)), rng.randint(9, 22))

        # ---------------- upcoming assignments (note the cross-subject clashes on day 3 and day 6)
        upcoming = [
            (dbms, "Normalization assignment", "assignment", 3, 3, 2, "Normalize the given schema to 3NF and BCNF."),
            (os_, "Deadlock practical", "practical", 3, 2, 3, "Implement Banker's algorithm."),
            (cn, "Subnetting lab", "practical", 2, 2, 3, "Solve the 10 subnetting problems in the lab manual."),
            (dbms, "SQL joins worksheet", "assignment", 2, 2, 6, None),
            (cn, "CN unit test", "exam", 4, 6, 6, "Units 1-3."),
            (os_, "Memory management assignment", "assignment", 4, 4, 11, None),
            (dbms, "Mini project: schema design", "project", 4, 6, 15, "Submit ER diagram + schema for your mini project."),
        ]
        for c, title, kind, diff, hours, due_days, desc in upcoming:
            a = Assignment(classroom_id=c.id, teacher_id=c.teacher_id, title=title, description=desc, type=kind,
                           difficulty=diff, expected_hours=hours, due_date=at(due_days, 23 if kind != "exam" else 10),
                           start_date=max(TODAY - timedelta(days=3), TODAY + timedelta(days=due_days - 7)), created_at=at(-3, 11))
            db.session.add(a)
            db.session.flush()
            push_assignment(a, announce=False)
            for task in a.tasks:
                if task.user_id == demo.id:
                    continue
                r, sp = rng.random(), speed[task.user_id]
                if due_days <= 3 and r < (0.15 if sp > 1.6 else 0.35):
                    task.status, task.actual_hours = "done", round(hours * sp * 2) / 2
                    task.completed_at = at(-rng.randint(0, 1), 20)
                elif r < 0.6 and sp < 1.6:
                    task.status = "in_progress"

        # ---------------- the demo student's personal tasks
        sub = Subject(user_id=demo.id, name="Personal", colour="#EC4899")
        db.session.add(sub)
        db.session.flush()
        db.session.add_all([
            Task(user_id=demo.id, subject_id=sub.id, title="Hackathon prep", type="project", difficulty=3,
                 priority=3, estimated_hours=4, due_date=at(5, 18)),
            Task(user_id=demo.id, subject_id=sub.id, title="Aptitude practice set", type="other", difficulty=2,
                 priority=2, estimated_hours=2, due_date=at(8, 21)),
        ])

        # ---------------- weekly stress check-ins (last 4 weeks)
        monday = TODAY - timedelta(days=TODAY.weekday())
        for s in students:
            for w in range(4):
                if rng.random() < 0.75:
                    base = 2 + (speed[s.id] - 1) * 3 + (0.6 if w == 0 else 0)
                    db.session.add(CheckIn(user_id=s.id, week_start=monday - timedelta(weeks=w),
                                           stress=max(1, min(5, round(base + rng.uniform(-0.8, 0.8))))))

        db.session.flush()

        # ---------------- pending extension requests for the DBMS/OS teacher
        reasons = ["CN unit test and two practicals fall in the same three days.",
                   "I was unwell for two days and am behind on all three subjects.",
                   "Three deadlines on the same day; I need one more day to do this properly."]
        norm = db.session.scalar(db.select(Assignment).where(Assignment.title == "Normalization assignment"))
        slow = [s for s in sorted(students[1:], key=lambda s: -speed[s.id])
                if db.session.scalar(db.select(Task.status).where(Task.user_id == s.id, Task.assignment_id == norm.id)) != "done"]
        for s, reason in zip(slow, reasons):
            task = db.session.scalar(db.select(Task).where(Task.user_id == s.id, Task.assignment_id == norm.id))
            requested = task.due_date + timedelta(days=2)
            db.session.add(ExtensionRequest(task_id=task.id, assignment_id=norm.id, student_id=s.id, reason=reason,
                                            requested_due=requested,
                                            evidence=json.dumps(extension_evidence(s.id, task, requested))))

        db.session.flush()
        for s in students:
            recompute_alerts(s.id)
        db.session.commit()

        print("Demo data ready (password for every account: demo12345)")
        print("  Teacher (DBMS + OS): teacher@taskorbit.in")
        print("  Teacher (CN):        cn.teacher@taskorbit.in")
        print("  Student:             demo@taskorbit.in   (+ student01..29@taskorbit.in)")
        print("  Class codes: DBMS4A, OSYS4A, CNET4A")


if __name__ == "__main__":
    main()
