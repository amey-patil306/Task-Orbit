"""Teacher API (PLAN_V2 section 5). Every route checks the teacher role and ownership."""
from flask import Blueprint, jsonify, request

from ..extensions import db
from ..models import Assignment, Classroom, Enrollment, ExtensionRequest, Task, User
from ..models.classroom import new_join_code
from ..schemas.classroom import AssignmentIn, AssignmentUpdate, ClassroomIn, DeadlineCheckIn, ExtensionDecision
from ..services import analytics
from ..services.alert_service import recompute_alerts
from ..services.class_service import notify, push_assignment, sync_assignment
from ..utils.dates import iso_date, local_day, utcnow
from ..utils.errors import ApiError, not_found
from ..utils.request import current_user_id, parse_body, require_role

bp = Blueprint("teacher", __name__, url_prefix="/api/teacher")


def _my_classroom(classroom_id: int) -> Classroom:
    c = db.session.scalar(db.select(Classroom).where(Classroom.id == classroom_id,
                                                     Classroom.teacher_id == current_user_id()))
    if c is None:
        raise not_found("Class")
    return c


def _my_assignment(assignment_id: int) -> Assignment:
    a = db.session.scalar(db.select(Assignment).where(Assignment.id == assignment_id,
                                                      Assignment.teacher_id == current_user_id()))
    if a is None:
        raise not_found("Assignment")
    return a


# ---------------------------------------------------------------- dashboard

@bp.get("/overview")
@require_role("teacher")
def overview():
    """Everything the teacher home screen needs in one request."""
    teacher = db.session.get(User, current_user_id())
    classes = []
    for c in teacher.classrooms_taught:
        ctx = analytics.load_context(c.student_ids())
        roster = analytics.roster_with_risk(c, ctx)
        heat = analytics.class_heatmap(ctx, analytics.local_today(), 14)
        upcoming = c.assignments.filter(Assignment.due_date >= utcnow()).order_by(Assignment.due_date).limit(3).all()
        classes.append({
            **c.to_dict(with_counts=True),
            "at_risk": sum(r["risk"] == "high" for r in roster),
            "peak_overload": max((d["pct_overloaded"] for d in heat), default=0.0),
            "heatmap": heat,
            "upcoming": [analytics.assignment_stats(a) for a in upcoming],
        })
    pending = db.session.scalar(db.select(db.func.count(ExtensionRequest.id)).join(Assignment).where(
        Assignment.teacher_id == teacher.id, ExtensionRequest.status == "pending"))
    return jsonify({"classes": classes, "pending_extensions": pending, "insights": analytics.teacher_insights(teacher)})


@bp.get("/insights")
@require_role("teacher")
def insights():
    return jsonify(analytics.teacher_insights(db.session.get(User, current_user_id())))


# ---------------------------------------------------------------- classrooms

@bp.get("/classrooms")
@require_role("teacher")
def list_classrooms():
    rows = db.session.scalars(db.select(Classroom).where(Classroom.teacher_id == current_user_id())
                              .order_by(Classroom.created_at))
    return jsonify([c.to_dict(with_counts=True) for c in rows])


@bp.post("/classrooms")
@require_role("teacher")
def create_classroom():
    data = parse_body(ClassroomIn)
    code = new_join_code()
    while db.session.scalar(db.select(Classroom.id).where(Classroom.join_code == code)):
        code = new_join_code()
    c = Classroom(teacher_id=current_user_id(), name=data.name, subject_name=data.subject_name,
                  colour=data.colour.upper(), join_code=code)
    db.session.add(c)
    db.session.commit()
    return jsonify(c.to_dict(with_counts=True)), 201


@bp.get("/classrooms/<int:classroom_id>")
@require_role("teacher")
def classroom_detail(classroom_id: int):
    c = _my_classroom(classroom_id)
    return jsonify({**c.to_dict(with_counts=True), "roster": analytics.roster_with_risk(c)})


@bp.put("/classrooms/<int:classroom_id>")
@require_role("teacher")
def update_classroom(classroom_id: int):
    c = _my_classroom(classroom_id)
    data = parse_body(ClassroomIn)
    c.name, c.subject_name, c.colour = data.name, data.subject_name, data.colour.upper()
    db.session.commit()
    return jsonify(c.to_dict(with_counts=True))


@bp.delete("/classrooms/<int:classroom_id>")
@require_role("teacher")
def delete_classroom(classroom_id: int):
    c = _my_classroom(classroom_id)
    students = c.student_ids()
    db.session.delete(c)  # cascades to assignments and the students' copies
    db.session.flush()
    for sid in students:
        recompute_alerts(sid)
    db.session.commit()
    return "", 204


@bp.delete("/classrooms/<int:classroom_id>/students/<int:student_id>")
@require_role("teacher")
def remove_student(classroom_id: int, student_id: int):
    c = _my_classroom(classroom_id)
    e = db.session.scalar(db.select(Enrollment).where(Enrollment.classroom_id == c.id, Enrollment.student_id == student_id))
    if e is None:
        raise not_found("Student")
    db.session.delete(e)
    _drop_open_class_tasks(c, student_id)
    db.session.commit()
    return "", 204


def _drop_open_class_tasks(classroom: Classroom, student_id: int) -> None:
    """Remove a student's unfinished copies of this class's assignments (finished ones stay as history)."""
    ids = [a.id for a in classroom.assignments]
    if ids:
        for t in db.session.scalars(db.select(Task).where(Task.user_id == student_id, Task.assignment_id.in_(ids),
                                                          Task.status != "done")):
            db.session.delete(t)
    db.session.flush()
    recompute_alerts(student_id)


@bp.get("/classrooms/<int:classroom_id>/analytics")
@require_role("teacher")
def classroom_analytics(classroom_id: int):
    return jsonify(analytics.class_analytics(_my_classroom(classroom_id)))


@bp.post("/classrooms/<int:classroom_id>/deadline-check")
@require_role("teacher")
def deadline_check(classroom_id: int):
    c = _my_classroom(classroom_id)
    data = parse_body(DeadlineCheckIn)
    return jsonify(analytics.deadline_advice(c, data.expected_hours, data.due_date, data.start_date,
                                             data.exclude_assignment_id))


# ---------------------------------------------------------------- assignments

@bp.get("/classrooms/<int:classroom_id>/assignments")
@require_role("teacher")
def list_assignments(classroom_id: int):
    c = _my_classroom(classroom_id)
    return jsonify([analytics.assignment_stats(a) for a in c.assignments.order_by(Assignment.due_date.desc())])


@bp.post("/classrooms/<int:classroom_id>/assignments")
@require_role("teacher")
def create_assignment(classroom_id: int):
    c = _my_classroom(classroom_id)
    data = parse_body(AssignmentIn)
    if data.due_date <= utcnow():
        raise ApiError(400, "validation_error", "Invalid input", {"due_date": "must be in the future"})
    a = Assignment(classroom_id=c.id, teacher_id=current_user_id(), **data.model_dump())
    db.session.add(a)
    db.session.flush()
    push_assignment(a)
    db.session.commit()
    return jsonify(analytics.assignment_stats(a)), 201


@bp.get("/assignments/<int:assignment_id>")
@require_role("teacher")
def assignment_detail(assignment_id: int):
    a = _my_assignment(assignment_id)
    return jsonify({**analytics.assignment_stats(a, with_students=True), "classroom": a.classroom.to_dict()})


@bp.put("/assignments/<int:assignment_id>")
@require_role("teacher")
def update_assignment(assignment_id: int):
    a = _my_assignment(assignment_id)
    data = parse_body(AssignmentUpdate)
    old_due, old_expected = a.due_date, a.expected_hours
    for field, value in data.model_dump(include=data.model_fields_set).items():
        if value is None and field not in ("description", "start_date"):
            raise ApiError(400, "validation_error", "Invalid input", {field: "cannot be empty"})
        setattr(a, field, value)
    if a.start_date and a.start_date > a.due_date.date():
        raise ApiError(400, "validation_error", "Invalid input", {"start_date": "must be on or before due_date"})
    sync_assignment(a, old_due, old_expected)
    db.session.commit()
    return jsonify(analytics.assignment_stats(a))


@bp.delete("/assignments/<int:assignment_id>")
@require_role("teacher")
def delete_assignment(assignment_id: int):
    a = _my_assignment(assignment_id)
    students = [t.user_id for t in a.tasks]
    db.session.delete(a)
    db.session.flush()
    for sid in students:
        recompute_alerts(sid)
    db.session.commit()
    return "", 204


# ---------------------------------------------------------------- extension inbox

@bp.get("/extension-requests")
@require_role("teacher")
def list_extensions():
    stmt = (db.select(ExtensionRequest).join(Assignment)
            .where(Assignment.teacher_id == current_user_id()).order_by(ExtensionRequest.created_at.desc()))
    status = request.args.get("status")
    if status:
        stmt = stmt.where(ExtensionRequest.status == status)
    return jsonify([r.to_dict() for r in db.session.scalars(stmt)])


@bp.patch("/extension-requests/<int:request_id>")
@require_role("teacher")
def decide_extension(request_id: int):
    req = db.session.scalar(db.select(ExtensionRequest).join(Assignment).where(
        ExtensionRequest.id == request_id, Assignment.teacher_id == current_user_id()))
    if req is None:
        raise not_found("Extension request")
    if req.status != "pending":
        raise ApiError(409, "already_decided", "This request was already decided")
    data = parse_body(ExtensionDecision)

    req.status, req.teacher_note, req.decided_at = data.status, data.teacher_note, utcnow()
    title = req.assignment.title
    if data.status == "approved":
        new_due = data.new_due or req.requested_due
        req.task.due_date = new_due  # only this student's copy moves
        notify(req.student_id, f"Extension approved for \"{title}\": new due date {iso_date(local_day(new_due))}."
               + (f" Note: {data.teacher_note}" if data.teacher_note else ""), kind="extension")
    else:
        notify(req.student_id, f"Extension not approved for \"{title}\"."
               + (f" Note: {data.teacher_note}" if data.teacher_note else ""), kind="extension", severity="warning")
    db.session.flush()
    recompute_alerts(req.student_id)
    db.session.commit()
    return jsonify(req.to_dict())
