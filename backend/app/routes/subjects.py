from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from ..extensions import db
from ..models import Subject
from ..schemas import SubjectIn
from ..utils.request import current_user_id, get_owned_or_404, parse_body

bp = Blueprint("subjects", __name__, url_prefix="/api/subjects")


@bp.get("")
@jwt_required()
def list_subjects():
    rows = db.session.scalars(
        db.select(Subject).where(Subject.user_id == current_user_id()).order_by(Subject.name)
    )
    return jsonify([s.to_dict() for s in rows])


@bp.post("")
@jwt_required()
def create_subject():
    data = parse_body(SubjectIn)
    subject = Subject(user_id=current_user_id(), name=data.name, colour=data.colour)
    db.session.add(subject)
    db.session.commit()
    return jsonify(subject.to_dict()), 201


@bp.put("/<int:subject_id>")
@jwt_required()
def update_subject(subject_id: int):
    subject = get_owned_or_404(Subject, subject_id, "Subject")
    data = parse_body(SubjectIn)
    subject.name = data.name
    subject.colour = data.colour
    db.session.commit()
    return jsonify(subject.to_dict())


@bp.delete("/<int:subject_id>")
@jwt_required()
def delete_subject(subject_id: int):
    subject = get_owned_or_404(Subject, subject_id, "Subject")
    db.session.delete(subject)  # its tasks keep existing with subject_id = NULL
    db.session.commit()
    return "", 204
