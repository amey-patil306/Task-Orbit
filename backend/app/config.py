"""App configuration, read from environment variables (see .env.example)."""
import os
from datetime import timedelta


def _database_url() -> str:
    url = os.getenv("DATABASE_URL", "sqlite:///dev.db")
    # Some hosts hand out "postgres://", which SQLAlchemy 2 no longer accepts.
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    return url


def _engine_options(url: str) -> dict:
    # The free Neon database drops idle connections, so ping before use
    # and keep the pool small (section 4).
    options = {"pool_pre_ping": True}
    if url.startswith("postgresql"):
        options.update(pool_size=3, max_overflow=2, pool_recycle=300)
    return options


class Config:
    SQLALCHEMY_DATABASE_URI = _database_url()
    SQLALCHEMY_ENGINE_OPTIONS = _engine_options(SQLALCHEMY_DATABASE_URI)
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-only-change-me-please-32-bytes!")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=int(os.getenv("JWT_EXPIRES_DAYS", "7")))

    CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

    # Teachers must enter this code when registering, so students can't sign up as teachers.
    TEACHER_SIGNUP_CODE = os.getenv("TEACHER_SIGNUP_CODE", "ZCOER-TEACHER")

    JSON_SORT_KEYS = False
