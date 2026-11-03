from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from ..extensions import db
from ..models import Availability
from ..models.availability import DEFAULT_HOURS
from ..schemas import AvailabilityUpdate
from ..utils.request import current_user_id, parse_body

bp = Blueprint("availability", __name__, url_prefix="/api/availability")


def _rows_for(user_id: int) -> dict[int, Availability]:
    """All seven rows for a user, creating any missing ones with the defaults."""
    rows = {a.weekday: a for a in db.session.scalars(db.select(Availability).where(Availability.user_id == user_id))}
    for weekday, hours in DEFAULT_HOURS.items():
        if weekday not in rows:
            rows[weekday] = Availability(user_id=user_id, weekday=weekday, hours=hours)
            db.session.add(rows[weekday])
    return rows


def _response(rows: dict[int, Availability]):
    return jsonify([rows[d].to_dict() for d in sorted(rows)])


@bp.get("")
@jwt_required()
def get_availability():
    rows = _rows_for(current_user_id())
    db.session.commit()
    return _response(rows)


@bp.put("")
@jwt_required()
def put_availability():
    items = parse_body(AvailabilityUpdate).root
    rows = _rows_for(current_user_id())
    for item in items:
        rows[item.weekday].hours = item.hours
    db.session.commit()
    return _response(rows)
