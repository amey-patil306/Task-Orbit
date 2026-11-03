from datetime import datetime

import pytest
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import Availability, Task, User


@pytest.fixture()
def user(app):
    u = User(name="T", email="t@example.com")
    u.set_password("password123")
    db.session.add(u)
    db.session.commit()
    return u


def _task(user, **kw):
    fields = dict(user_id=user.id, title="T", estimated_hours=2, due_date=datetime(2026, 11, 20))
    fields.update(kw)
    return Task(**fields)


@pytest.mark.parametrize("kw", [
    {"difficulty": 0}, {"difficulty": 6}, {"priority": 0}, {"priority": 6},
    {"estimated_hours": 0}, {"estimated_hours": -1},
])
def test_task_check_constraints(user, kw):
    db.session.add(_task(user, **kw))
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()


def test_task_type_must_be_known(user):
    db.session.add(_task(user, type="holiday"))
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()


def test_one_availability_row_per_weekday(user):
    db.session.add_all([Availability(user_id=user.id, weekday=1, hours=2), Availability(user_id=user.id, weekday=1, hours=4)])
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()
