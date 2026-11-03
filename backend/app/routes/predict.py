from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from ..services import ml_service
from ..services.availability_service import availability_map
from ..utils.dates import local_today
from ..utils.request import current_user_id
from .workload import open_tasks

bp = Blueprint("predict", __name__, url_prefix="/api")


@bp.post("/predict")
@jwt_required()
def predict():
    """Overload risk for the next 7 days (ML when a model is loaded, otherwise rules)."""
    user_id = current_user_id()
    return jsonify(ml_service.forecast(open_tasks(user_id), availability_map(user_id), local_today(), 7))
