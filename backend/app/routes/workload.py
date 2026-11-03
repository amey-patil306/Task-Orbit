from datetime import date, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from ..extensions import db
from ..models import Task, WorkloadSnapshot
from ..services import ml_service
from ..services.availability_service import availability_map
from ..services.workload_engine import daily_load, find_conflicts
from ..utils.dates import local_today
from ..utils.errors import ApiError
from ..utils.request import current_user_id

bp = Blueprint("workload", __name__, url_prefix="/api/workload")

MAX_RANGE_DAYS = 92


def open_tasks(user_id: int):
    return db.session.scalars(db.select(Task).where(Task.user_id == user_id, Task.status != "done")).all()


def speed_ratio_for(user_id: int) -> float:
    """The student's actual / estimated hours so far (an ML feature; 1.0 for new students)."""
    from ml.features import user_speed_ratio  # noqa: PLC0415

    done = db.session.scalars(db.select(Task).where(Task.user_id == user_id, Task.status == "done")).all()
    return user_speed_ratio(done)


def class_ratio_for(tasks) -> dict:
    """{assignment_id: classmates' actual / expected hours so far} - the class_ratio_7d feature's input."""
    from ..services.analytics import class_ratios  # noqa: PLC0415

    return {aid: ratio for aid, (ratio, _n) in class_ratios([t.assignment_id for t in tasks if t.assignment_id]).items()}


def _parse_date(name: str, default: date) -> date:
    value = request.args.get(name)
    if not value:
        return default
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ApiError(400, "validation_error", "Invalid input", {name: "use YYYY-MM-DD"}) from None


def _save_snapshot(user_id: int, row: dict, ml_label: str | None) -> None:
    """Keep one row per user per day, for charts and as real training data."""
    day = date.fromisoformat(row["date"])
    snap = db.session.scalar(db.select(WorkloadSnapshot).where(
        WorkloadSnapshot.user_id == user_id, WorkloadSnapshot.day == day))
    if snap is None:
        snap = WorkloadSnapshot(user_id=user_id, day=day)
        db.session.add(snap)
    snap.hours_required = row["hours_required"]
    snap.hours_available = row["hours_available"]
    snap.load_ratio = row["load_ratio"] if row["load_ratio"] is not None else 99.0
    snap.rule_label = row["rule_label"]
    snap.ml_label = ml_label


@bp.get("")
@jwt_required()
def get_workload():
    user_id = current_user_id()
    today = local_today()
    start = _parse_date("from", today)
    end = _parse_date("to", start + timedelta(days=13))
    if end < start:
        raise ApiError(400, "validation_error", "Invalid input", {"to": "must be on or after from"})
    if (end - start).days >= MAX_RANGE_DAYS:
        raise ApiError(400, "validation_error", "Invalid input", {"to": f"range is limited to {MAX_RANGE_DAYS} days"})

    tasks = open_tasks(user_id)
    availability = availability_map(user_id)
    rows = daily_load(tasks, availability, start, end, today)
    ml = ml_service.ml_labels(tasks, availability, today, 7, speed_ratio_for(user_id), class_ratio_for(tasks))
    for row in rows:
        row["ml_label"] = ml.get(row["date"])
        if row["date"] == today.isoformat():
            _save_snapshot(user_id, row, row["ml_label"])
    db.session.commit()
    return jsonify(rows)


@bp.get("/conflicts")
@jwt_required()
def get_conflicts():
    return jsonify(find_conflicts(open_tasks(current_user_id()), local_today(), 14))
