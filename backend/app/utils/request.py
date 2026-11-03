"""Request helpers shared by the route modules."""
from functools import wraps

from flask import request
from flask_jwt_extended import get_jwt_identity, jwt_required
from pydantic import BaseModel

from ..extensions import db
from .errors import ApiError, not_found


def json_body() -> dict | list:
    data = request.get_json(silent=True)
    if data is None:
        raise ApiError(400, "validation_error", "Request body must be JSON")
    return data


def parse_body(schema: type[BaseModel]):
    """Validate the JSON body with a pydantic model (errors become a 400 via the handler)."""
    return schema.model_validate(json_body())


def current_user_id() -> int:
    return int(get_jwt_identity())


def current_user():
    from ..models import User  # noqa: PLC0415 - avoid import cycle

    user = db.session.get(User, current_user_id())
    if user is None:
        raise ApiError(401, "unauthorized", "Account no longer exists")
    return user


def require_role(role: str):
    """Decorator for routes only one role may use (wrong role -> 403)."""
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            if current_user().role != role:
                raise ApiError(403, "forbidden", f"Only {role}s can do this")
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def get_owned_or_404(model, obj_id: int, what: str | None = None):
    """Fetch a row that belongs to the logged-in user, or 404 (never 403, section 8)."""
    obj = db.session.scalar(
        db.select(model).where(model.id == obj_id, model.user_id == current_user_id())
    )
    if obj is None:
        raise not_found(what or model.__name__)
    return obj
