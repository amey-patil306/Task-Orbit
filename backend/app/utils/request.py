"""Request helpers shared by the route modules."""
from flask import request
from flask_jwt_extended import get_jwt_identity
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


def get_owned_or_404(model, obj_id: int, what: str | None = None):
    """Fetch a row that belongs to the logged-in user, or 404 (never 403, section 8)."""
    obj = db.session.scalar(
        db.select(model).where(model.id == obj_id, model.user_id == current_user_id())
    )
    if obj is None:
        raise not_found(what or model.__name__)
    return obj
