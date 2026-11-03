import pytest

from app import create_app
from app.extensions import db as _db


@pytest.fixture()
def app():
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite://",  # in-memory, fresh per test
        "SQLALCHEMY_ENGINE_OPTIONS": {},
        "JWT_SECRET_KEY": "test-secret-key-that-is-long-enough-32b",
    })
    with app.app_context():
        _db.create_all()
        yield app
        _db.session.remove()
        _db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def register(client):
    """Register a user and return (headers, user)."""
    def _register(email="asha@example.com", name="Asha", password="password123"):
        res = client.post("/api/auth/register", json={"name": name, "email": email, "password": password})
        assert res.status_code == 201, res.get_json()
        body = res.get_json()
        return {"Authorization": f"Bearer {body['access_token']}"}, body["user"]
    return _register


@pytest.fixture()
def auth(register):
    headers, _ = register()
    return headers
