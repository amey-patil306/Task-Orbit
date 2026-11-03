from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from ..services import ml_service
from ..services.availability_service import availability_map
from ..utils.dates import local_today
from ..utils.request import current_user_id
from .workload import class_ratio_for, open_tasks, speed_ratio_for

bp = Blueprint("predict", __name__, url_prefix="/api")


@bp.post("/predict")
@jwt_required()
def predict():
    """Overload risk for the next 7 days (ML model A when loaded, otherwise rules)."""
    user_id = current_user_id()
    tasks = open_tasks(user_id)
    return jsonify(ml_service.forecast(tasks, availability_map(user_id), local_today(), 7,
                                       speed_ratio_for(user_id), class_ratio_for(tasks)))


@bp.get("/ml/status")
@jwt_required()
def ml_status():
    """Which models are loaded (shown in the UI and useful in the viva)."""
    return jsonify(ml_service.status())
