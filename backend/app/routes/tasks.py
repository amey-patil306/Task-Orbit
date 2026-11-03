from datetime import datetime, time, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from ..extensions import db
from ..models import Subject, Task
from ..schemas import TaskComplete, TaskCreate, TaskQuery, TaskUpdate
from ..services.availability_service import availability_map
from ..services.workload_engine import workload_summary
from ..utils.dates import utcnow
from ..utils.errors import ApiError
from ..utils.request import current_user_id, get_owned_or_404, parse_body

bp = Blueprint("tasks", __name__, url_prefix="/api/tasks")


def _check_subject(subject_id: int | None, user_id: int) -> None:
    """A task may only point at one of the user's own subjects."""
    if subject_id is None:
        return
    owned = db.session.scalar(db.select(Subject.id).where(Subject.id == subject_id, Subject.user_id == user_id))
    if owned is None:
        raise ApiError(400, "validation_error", "Invalid input", {"subject_id": "subject not found"})


def _summary(user_id: int) -> dict:
    tasks = db.session.scalars(db.select(Task).where(Task.user_id == user_id, Task.status != "done")).all()
    return workload_summary(tasks, availability_map(user_id), today=utcnow().date())


def _task_with_summary(task: Task, user_id: int) -> dict:
    return {"task": task.to_dict(), "workload_summary": _summary(user_id)}


def _apply_status(task: Task, status: str) -> None:
    if status == "done" and task.status != "done":
        task.completed_at = utcnow()
    elif status != "done":
        task.completed_at = None
    task.status = status


@bp.get("")
@jwt_required()
def list_tasks():
    q = TaskQuery.model_validate(request.args.to_dict())
    stmt = db.select(Task).where(Task.user_id == current_user_id())
    if q.status:
        stmt = stmt.where(Task.status == q.status)
    if q.type:
        stmt = stmt.where(Task.type == q.type)
    if q.subject_id is not None:
        stmt = stmt.where(Task.subject_id == q.subject_id)
    if q.from_:
        stmt = stmt.where(Task.due_date >= datetime.combine(q.from_, time.min))
    if q.to:
        stmt = stmt.where(Task.due_date < datetime.combine(q.to + timedelta(days=1), time.min))
    stmt = stmt.order_by(Task.due_date, Task.id)
    return jsonify([t.to_dict() for t in db.session.scalars(stmt)])


@bp.post("")
@jwt_required()
def create_task():
    user_id = current_user_id()
    data = parse_body(TaskCreate)
    _check_subject(data.subject_id, user_id)

    task = Task(user_id=user_id, **data.model_dump(exclude={"status"}))
    _apply_status(task, data.status)
    db.session.add(task)
    db.session.commit()
    # TODO(section 9): recompute alerts for the affected dates.
    return jsonify(_task_with_summary(task, user_id)), 201


@bp.put("/<int:task_id>")
@jwt_required()
def update_task(task_id: int):
    user_id = current_user_id()
    task = get_owned_or_404(Task, task_id, "Task")
    data = parse_body(TaskUpdate)
    changes = data.model_dump(include=data.model_fields_set)

    if "subject_id" in changes:
        _check_subject(changes["subject_id"], user_id)
    start = changes.get("start_date", task.start_date)
    due = changes.get("due_date", task.due_date)
    if start and start > due.date():
        raise ApiError(400, "validation_error", "Invalid input", {"start_date": "start_date must be on or before due_date"})

    status = changes.pop("status", None)
    for field, value in changes.items():
        setattr(task, field, value)
    if status:
        _apply_status(task, status)
    db.session.commit()
    # TODO(section 9): recompute alerts for the affected dates.
    return jsonify(_task_with_summary(task, user_id))


@bp.patch("/<int:task_id>/complete")
@jwt_required()
def complete_task(task_id: int):
    task = get_owned_or_404(Task, task_id, "Task")
    data = parse_body(TaskComplete)
    task.actual_hours = data.actual_hours
    _apply_status(task, "done")
    db.session.commit()
    # TODO(section 9): recompute alerts for the affected dates.
    return jsonify(task.to_dict())


@bp.delete("/<int:task_id>")
@jwt_required()
def delete_task(task_id: int):
    task = get_owned_or_404(Task, task_id, "Task")
    db.session.delete(task)
    db.session.commit()
    # TODO(section 9): recompute alerts for the affected dates.
    return "", 204
