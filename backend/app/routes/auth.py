from flask import Blueprint, current_app, jsonify
from flask_jwt_extended import create_access_token, jwt_required

from ..extensions import db
from ..models import User
from ..models.availability import default_availability
from ..schemas import LoginIn, RegisterIn
from ..utils.errors import ApiError
from ..utils.request import current_user_id, parse_body

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def _auth_payload(user: User):
    return {"user": user.to_dict(), "access_token": create_access_token(identity=str(user.id))}


@bp.post("/register")
def register():
    data = parse_body(RegisterIn)
    if data.role == "teacher" and data.teacher_code != current_app.config["TEACHER_SIGNUP_CODE"]:
        raise ApiError(400, "validation_error", "Invalid teacher code",
                       {"teacher_code": "Ask your department for the teacher signup code"})
    if db.session.scalar(db.select(User.id).where(User.email == data.email)) is not None:
        raise ApiError(409, "email_taken", "An account with this email already exists", {"email": "already registered"})

    user = User(name=data.name, email=data.email, role=data.role,
                department=data.department, year=data.year, division=data.division)
    user.set_password(data.password)
    db.session.add(user)
    db.session.flush()  # assigns user.id
    if user.role == "student":
        db.session.add_all(default_availability(user.id))
    db.session.commit()
    return jsonify(_auth_payload(user)), 201


@bp.post("/login")
def login():
    data = parse_body(LoginIn)
    user = db.session.scalar(db.select(User).where(User.email == data.email))
    if user is None or not user.check_password(data.password):
        raise ApiError(401, "invalid_credentials", "Email or password is incorrect")
    return jsonify(_auth_payload(user))


@bp.get("/me")
@jwt_required()
def me():
    user = db.session.get(User, current_user_id())
    if user is None:
        raise ApiError(401, "unauthorized", "Account no longer exists")
    return jsonify({"user": user.to_dict()})
