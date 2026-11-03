from collections import defaultdict
from types import SimpleNamespace

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from ..extensions import db
from ..models import StudySession, Task
from ..schemas.plan import PlanGenerate, SessionUpdate
from ..services.analytics import ml_estimates
from ..services.availability_service import availability_map
from ..services.planner import build_plan, suggestions_for
from ..utils.dates import local_today
from ..utils.request import current_user_id, get_owned_or_404, parse_body

bp = Blueprint("planner", __name__, url_prefix="/api/plan")


def _sessions(user_id: int):
    stmt = (db.select(StudySession).join(Task)
            .where(StudySession.user_id == user_id, Task.status != "done")
            .order_by(StudySession.planned_date, StudySession.id))
    return db.session.scalars(stmt).all()


@bp.post("/generate")
@jwt_required()
def generate():
    user_id = current_user_id()
    body = PlanGenerate.model_validate(request.get_json(silent=True) or {})
    today = local_today()

    # Sessions already ticked done count as studied hours; the rest are replaced.
    done_hours = defaultdict(float)
    for s in db.session.scalars(db.select(StudySession).where(StudySession.user_id == user_id)):
        if s.done:
            done_hours[s.task_id] += s.planned_hours
        else:
            db.session.delete(s)

    tasks = db.session.scalars(db.select(Task).where(Task.user_id == user_id, Task.status != "done")).all()
    finished = db.session.scalars(db.select(Task).where(Task.user_id == user_id, Task.status == "done")).all()
    # Model B: plan with the hours the student will REALLY need, not their (usually optimistic) estimate.
    ml_hours = ml_estimates(tasks, finished)
    plan_tasks = [SimpleNamespace(id=t.id, title=t.title, status=t.status, type=t.type, priority=t.priority,
                                  difficulty=t.difficulty, start_date=t.start_date, due_date=t.due_date,
                                  estimated_hours=ml_hours.get(t.id, t.estimated_hours)) for t in tasks]
    planned, unscheduled = build_plan(plan_tasks, availability_map(user_id), today, body.horizon_days, done_hours)
    db.session.add_all(StudySession(user_id=user_id, **p) for p in planned)
    db.session.commit()

    return jsonify({
        "sessions": [s.to_dict() for s in _sessions(user_id)],
        "unscheduled": unscheduled,
        "suggestions": suggestions_for(unscheduled, today),
        "estimates": "ml" if ml_hours else "student",
        "adjusted": [{"task_id": t.id, "title": t.title, "your_estimate": t.estimated_hours, "ml_estimate": ml_hours[t.id]}
                     for t in tasks if t.id in ml_hours and abs(ml_hours[t.id] - t.estimated_hours) >= 0.5],
    })


@bp.get("")
@jwt_required()
def current_plan():
    return jsonify([s.to_dict() for s in _sessions(current_user_id())])


@bp.patch("/<int:session_id>")
@jwt_required()
def tick_session(session_id: int):
    session = get_owned_or_404(StudySession, session_id, "Study session")
    session.done = parse_body(SessionUpdate).done
    db.session.commit()
    return jsonify(session.to_dict())
