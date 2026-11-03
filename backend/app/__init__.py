"""Task Orbit backend: create_app() wires config, db, jwt, cors and blueprints."""
from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS
from sqlalchemy import event
from sqlalchemy.engine import Engine

from .config import Config
from .extensions import db, jwt, migrate
from .utils.errors import error_response, register_error_handlers

load_dotenv()


@event.listens_for(Engine, "connect")
def _sqlite_foreign_keys(dbapi_connection, _record):
    """SQLite ignores ON DELETE CASCADE / SET NULL unless foreign keys are switched on."""
    if dbapi_connection.__class__.__module__.startswith("sqlite3"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def _register_jwt_errors():
    @jwt.unauthorized_loader
    def _missing(reason):
        return error_response(401, "unauthorized", "Missing or malformed Authorization header")

    @jwt.invalid_token_loader
    def _invalid(reason):
        return error_response(401, "invalid_token", "Invalid token")

    @jwt.expired_token_loader
    def _expired(_header, _payload):
        return error_response(401, "token_expired", "Session expired, please log in again")


def create_app(overrides: dict | None = None) -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)
    if overrides:
        app.config.update(overrides)
    app.json.sort_keys = False

    db.init_app(app)
    migrate.init_app(app, db, render_as_batch=True)  # batch mode lets Alembic alter SQLite tables
    jwt.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})

    from . import models  # noqa: F401  (registers models)
    from .routes import BLUEPRINTS

    for bp in BLUEPRINTS:
        app.register_blueprint(bp)

    register_error_handlers(app)
    _register_jwt_errors()

    from .services import ml_service

    ml_service.init_app(app)  # load models once at start (section 10)
    return app
