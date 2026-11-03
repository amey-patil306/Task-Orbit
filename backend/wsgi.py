"""Entry point for gunicorn (`gunicorn wsgi:app`) and the flask CLI (`flask --app wsgi ...`)."""
from app import create_app

app = create_app()
