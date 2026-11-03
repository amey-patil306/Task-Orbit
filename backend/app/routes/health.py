from flask import Blueprint, jsonify

bp = Blueprint("health", __name__, url_prefix="/api")


@bp.get("/health")
def health():
    """Keep-alive and uptime check. Deliberately does not touch the database."""
    return jsonify({"status": "ok"})
