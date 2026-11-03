"""Keeps students' task lists in sync with their teachers' assignments."""
from ..extensions import db
from ..models import Alert, Assignment, Task
from ..utils.dates import iso_date, local_day, local_today, utcnow
from .alert_service import recompute_alerts


def notify(user_id: int, message: str, kind: str = "assignment", severity: str = "info") -> None:
    db.session.add(Alert(user_id=user_id, kind=kind, severity=severity, message=message[:500], for_date=local_today()))


def _task_for(assignment: Assignment, student_id: int) -> Task:
    return Task(
        user_id=student_id,
        assignment_id=assignment.id,
        title=assignment.title,
        description=assignment.description,
        type=assignment.type,
        difficulty=assignment.difficulty,
        priority=4 if assignment.type == "exam" else 3,
        estimated_hours=assignment.expected_hours,  # the student can change their own estimate
        start_date=assignment.start_date,
        due_date=assignment.due_date,
    )


def push_assignment(assignment: Assignment, student_ids: list[int] | None = None, announce: bool = True) -> None:
    """Give each student (default: everyone enrolled) their own copy of the assignment."""
    if student_ids is None:
        student_ids = assignment.classroom.student_ids()
    existing = set(db.session.scalars(
        db.select(Task.user_id).where(Task.assignment_id == assignment.id)))
    due = iso_date(local_day(assignment.due_date))
    for sid in student_ids:
        if sid in existing:
            continue
        db.session.add(_task_for(assignment, sid))
        if announce:
            notify(sid, f"New {assignment.type} in {assignment.classroom.name}: \"{assignment.title}\", due {due}.")
    db.session.flush()
    for sid in student_ids:
        recompute_alerts(sid)


def sync_assignment(assignment: Assignment, old_due, old_expected: float) -> None:
    """Copy a teacher's edits to students' tasks.

    Due date and estimate only change for students who still have the old value,
    so approved extensions and students' own estimates are kept.
    """
    for task in assignment.tasks:
        task.title = assignment.title
        task.description = assignment.description
        task.type = assignment.type
        task.difficulty = assignment.difficulty
        if task.due_date == old_due:
            task.due_date = assignment.due_date
            task.start_date = assignment.start_date
        if task.estimated_hours == old_expected:
            task.estimated_hours = assignment.expected_hours
        if old_due != assignment.due_date and task.status != "done":
            notify(task.user_id, f"Deadline changed for \"{assignment.title}\" ({assignment.classroom.name}): "
                                 f"now due {iso_date(local_day(task.due_date))}.")
    db.session.flush()
    for task in assignment.tasks:
        recompute_alerts(task.user_id)


def give_open_assignments(classroom, student_id: int) -> None:
    """A student who joins late still gets the class's upcoming assignments."""
    upcoming = db.session.scalars(db.select(Assignment).where(
        Assignment.classroom_id == classroom.id, Assignment.due_date >= utcnow())).all()
    for assignment in upcoming:
        push_assignment(assignment, [student_id], announce=False)
    recompute_alerts(student_id)
