from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from ..extensions import db
from ..schemas import AvailabilityUpdate
from ..services.alert_service import recompute_alerts
from ..services.availability_service import availability_rows
from ..utils.request import current_user_id, parse_body

bp = Blueprint("availability", __name__, url_prefix="/api/availability")


def _response(rows):
    return jsonify([rows[d].to_dict() for d in sorted(rows)])


@bp.get("")
@jwt_required()
def get_availability():
    rows = availability_rows(current_user_id())
    db.session.commit()
    return _response(rows)


@bp.put("")
@jwt_required()
def put_availability():
    items = parse_body(AvailabilityUpdate).root
    rows = availability_rows(current_user_id())
    for item in items:
        rows[item.weekday].hours = item.hours
    db.session.flush()
    recompute_alerts(current_user_id())  # fewer/more hours changes which days are overloaded
    db.session.commit()
    return _response(rows)
