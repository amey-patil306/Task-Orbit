from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from ..extensions import db
from ..models import Alert
from ..services.alert_service import recompute_alerts
from ..utils.request import current_user_id, get_owned_or_404

bp = Blueprint("alerts", __name__, url_prefix="/api/alerts")

SEVERITY_ORDER = {"critical": 0, "warning": 1, "info": 2}


@bp.get("")
@jwt_required()
def list_alerts():
    user_id = current_user_id()
    recompute_alerts(user_id)  # "today" moves on even when no task changes
    db.session.commit()

    stmt = db.select(Alert).where(Alert.user_id == user_id)
    if request.args.get("unread") == "true":
        stmt = stmt.where(Alert.is_read.is_(False))
    alerts = db.session.scalars(stmt.order_by(Alert.for_date.desc())).all()
    alerts.sort(key=lambda a: (a.is_read, SEVERITY_ORDER[a.severity], a.for_date))
    return jsonify([a.to_dict() for a in alerts[:100]])


@bp.patch("/<int:alert_id>/read")
@jwt_required()
def mark_read(alert_id: int):
    alert = get_owned_or_404(Alert, alert_id, "Alert")
    alert.is_read = True
    db.session.commit()
    return jsonify(alert.to_dict())
