"""Student side of classes: join with a code, extension requests, weekly check-ins."""
import json
from datetime import timedelta

from flask import Blueprint, jsonify

from ..extensions import db
from ..models import CheckIn, Classroom, Enrollment, ExtensionRequest, Task
from ..schemas.classroom import CheckInIn, ExtensionIn, JoinIn
from ..services.analytics import class_average_hours, extension_evidence
from ..services.class_service import give_open_assignments
from ..utils.dates import local_today, utcnow
from ..utils.errors import ApiError, not_found
from ..utils.request import current_user_id, get_owned_or_404, parse_body, require_role
from .teacher import _drop_open_class_tasks

bp = Blueprint("classrooms", __name__, url_prefix="/api")


@bp.get("/classrooms")
@require_role("student")
def my_classrooms():
    rows = db.session.scalars(db.select(Classroom).join(Enrollment)
                              .where(Enrollment.student_id == current_user_id()).order_by(Classroom.name))
    return jsonify([c.to_dict(with_counts=True) for c in rows])


@bp.post("/classrooms/join")
@require_role("student")
def join():
    code = parse_body(JoinIn).code
    c = db.session.scalar(db.select(Classroom).where(Classroom.join_code == code))
    if c is None:
        raise ApiError(404, "not_found", "No class with that code", {"code": "check the code with your teacher"})
    sid = current_user_id()
    if db.session.scalar(db.select(Enrollment.id).where(Enrollment.classroom_id == c.id, Enrollment.student_id == sid)):
        raise ApiError(409, "already_joined", "You are already in this class", {"code": "already joined"})
    db.session.add(Enrollment(classroom_id=c.id, student_id=sid))
    db.session.flush()
    give_open_assignments(c, sid)
    db.session.commit()
    return jsonify(c.to_dict(with_counts=True)), 201


@bp.delete("/classrooms/<int:classroom_id>/leave")
@require_role("student")
def leave(classroom_id: int):
    sid = current_user_id()
    e = db.session.scalar(db.select(Enrollment).where(Enrollment.classroom_id == classroom_id, Enrollment.student_id == sid))
    if e is None:
        raise not_found("Class")
    db.session.delete(e)
    _drop_open_class_tasks(e.classroom, sid)
    db.session.commit()
    return "", 204


# ---------------------------------------------------------------- teacher-task helpers

def _teacher_task(task_id: int) -> Task:
    task = get_owned_or_404(Task, task_id, "Task")
    if not task.assignment_id:
        raise ApiError(400, "not_teacher_task", "This only works for tasks set by a teacher")
    return task


@bp.get("/tasks/<int:task_id>/insight")
@require_role("student")
def task_insight(task_id: int):
    """'Classmates took 6.5 h on average' hint for teacher tasks."""
    task = _teacher_task(task_id)
    return jsonify({"expected_hours": task.assignment.expected_hours, **class_average_hours(task.assignment_id)})


@bp.post("/tasks/<int:task_id>/extension")
@require_role("student")
def request_extension(task_id: int):
    task = _teacher_task(task_id)
    data = parse_body(ExtensionIn)
    if task.status == "done":
        raise ApiError(400, "validation_error", "This task is already done")
    if data.requested_due <= task.due_date:
        raise ApiError(400, "validation_error", "Invalid input", {"requested_due": "must be after the current due date"})
    if data.requested_due > task.due_date + timedelta(days=14):
        raise ApiError(400, "validation_error", "Invalid input", {"requested_due": "ask for at most 14 extra days"})
    if db.session.scalar(db.select(ExtensionRequest.id).where(ExtensionRequest.task_id == task.id,
                                                              ExtensionRequest.status == "pending")):
        raise ApiError(409, "already_pending", "You already have a pending request for this task")

    req = ExtensionRequest(task_id=task.id, assignment_id=task.assignment_id, student_id=task.user_id,
                           reason=data.reason, requested_due=data.requested_due,
                           evidence=json.dumps(extension_evidence(task.user_id, task, data.requested_due)))
    db.session.add(req)
    db.session.commit()
    return jsonify(req.to_dict()), 201


@bp.get("/extensions")
@require_role("student")
def my_extensions():
    rows = db.session.scalars(db.select(ExtensionRequest).where(ExtensionRequest.student_id == current_user_id())
                              .order_by(ExtensionRequest.created_at.desc()))
    return jsonify([r.to_dict() for r in rows])


# ---------------------------------------------------------------- weekly stress check-in

@bp.get("/checkins")
@require_role("student")
def list_checkins():
    rows = db.session.scalars(db.select(CheckIn).where(CheckIn.user_id == current_user_id())
                              .order_by(CheckIn.week_start.desc()).limit(12))
    this_week = local_today() - timedelta(days=local_today().weekday())
    items = [c.to_dict() for c in rows]
    return jsonify({"this_week": this_week.isoformat(),
                    "done_this_week": any(i["week_start"] == this_week.isoformat() for i in items),
                    "items": items})


@bp.post("/checkins")
@require_role("student")
def save_checkin():
    data = parse_body(CheckInIn)
    week = local_today() - timedelta(days=local_today().weekday())
    c = db.session.scalar(db.select(CheckIn).where(CheckIn.user_id == current_user_id(), CheckIn.week_start == week))
    if c is None:
        c = CheckIn(user_id=current_user_id(), week_start=week, stress=data.stress)
        db.session.add(c)
    c.stress, c.note, c.created_at = data.stress, data.note, utcnow()
    db.session.commit()
    return jsonify(c.to_dict()), 201
