from datetime import datetime

from app.extensions import db
from app.models import Subject, Task, User


def assert_error(res, status, code=None):
    assert res.status_code == status, res.get_json()
    err = res.get_json()["error"]
    assert set(err) == {"code", "message", "fields"}
    if code:
        assert err["code"] == code
    return err


# ---------- health ----------

def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.get_json() == {"status": "ok"}


def test_unknown_route_uses_error_format(client):
    assert_error(client.get("/api/nope"), 404, "not_found")


# ---------- auth ----------

def test_register_returns_user_and_token(client):
    res = client.post("/api/auth/register", json={"name": "Asha", "email": "Asha@Example.com", "password": "password123"})
    assert res.status_code == 201
    body = res.get_json()
    assert body["access_token"]
    assert body["user"]["email"] == "asha@example.com"
    assert "password_hash" not in body["user"]


def test_password_is_hashed(app, register):
    register()
    user = db.session.scalar(db.select(User))
    assert user.password_hash != "password123"
    assert user.check_password("password123")


def test_register_validation_errors(client):
    res = client.post("/api/auth/register", json={"name": "", "email": "not-an-email", "password": "short"})
    err = assert_error(res, 400, "validation_error")
    assert {"name", "email", "password"} <= set(err["fields"])


def test_register_requires_json(client):
    assert_error(client.post("/api/auth/register", data="x"), 400, "validation_error")


def test_register_duplicate_email_is_409(client, register):
    register()
    res = client.post("/api/auth/register", json={"name": "B", "email": "ASHA@example.com", "password": "password123"})
    assert_error(res, 409, "email_taken")


def test_login_success_and_failure(client, register):
    register()
    ok = client.post("/api/auth/login", json={"email": "asha@example.com", "password": "password123"})
    assert ok.status_code == 200
    assert ok.get_json()["access_token"]

    bad = client.post("/api/auth/login", json={"email": "asha@example.com", "password": "wrong-pass"})
    assert_error(bad, 401, "invalid_credentials")
    unknown = client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "password123"})
    assert_error(unknown, 401, "invalid_credentials")


def test_me(client, register):
    headers, user = register()
    res = client.get("/api/auth/me", headers=headers)
    assert res.status_code == 200
    assert res.get_json()["user"]["id"] == user["id"]


def test_protected_routes_need_token(client):
    assert_error(client.get("/api/auth/me"), 401, "unauthorized")
    assert_error(client.get("/api/subjects"), 401)
    assert_error(client.get("/api/auth/me", headers={"Authorization": "Bearer garbage"}), 401, "invalid_token")


# ---------- subjects ----------

def test_subject_crud(client, auth):
    res = client.post("/api/subjects", json={"name": "DBMS", "colour": "#10b981"}, headers=auth)
    assert res.status_code == 201
    subject = res.get_json()
    assert subject["colour"] == "#10B981"

    res = client.put(f"/api/subjects/{subject['id']}", json={"name": "DBMS Lab", "colour": "#000000"}, headers=auth)
    assert res.status_code == 200
    assert res.get_json()["name"] == "DBMS Lab"

    listed = client.get("/api/subjects", headers=auth).get_json()
    assert [s["name"] for s in listed] == ["DBMS Lab"]

    assert client.delete(f"/api/subjects/{subject['id']}", headers=auth).status_code == 204
    assert client.get("/api/subjects", headers=auth).get_json() == []


def test_subject_validation(client, auth):
    err = assert_error(client.post("/api/subjects", json={"name": "X", "colour": "red"}, headers=auth), 400)
    assert "colour" in err["fields"]


def test_other_users_subject_is_404(client, register):
    owner, _ = register("a@example.com")
    intruder, _ = register("b@example.com")
    sid = client.post("/api/subjects", json={"name": "Maths"}, headers=owner).get_json()["id"]

    assert_error(client.put(f"/api/subjects/{sid}", json={"name": "Hacked"}, headers=intruder), 404, "not_found")
    assert_error(client.delete(f"/api/subjects/{sid}", headers=intruder), 404, "not_found")
    assert client.get("/api/subjects", headers=intruder).get_json() == []


def test_deleting_subject_nulls_task_subject(app, client, register):
    headers, user = register()
    sid = client.post("/api/subjects", json={"name": "OS"}, headers=headers).get_json()["id"]
    task = Task(user_id=user["id"], subject_id=sid, title="Lab 1", estimated_hours=2, due_date=datetime(2026, 11, 20, 17))
    db.session.add(task)
    db.session.commit()
    task_id = task.id

    client.delete(f"/api/subjects/{sid}", headers=headers)
    db.session.expire_all()
    assert db.session.get(Task, task_id).subject_id is None


def test_deleting_user_cascades(app, client, register):
    _, user = register()
    db.session.add(Subject(user_id=user["id"], name="CN"))
    db.session.commit()

    db.session.delete(db.session.get(User, user["id"]))
    db.session.commit()
    assert db.session.scalar(db.select(db.func.count(Subject.id))) == 0


# ---------- availability ----------

def test_availability_defaults(client, auth):
    rows = client.get("/api/availability", headers=auth).get_json()
    assert rows == [{"weekday": d, "hours": 3.0 if d < 5 else 5.0} for d in range(7)]


def test_availability_update(client, auth):
    res = client.put("/api/availability", json=[{"weekday": 0, "hours": 1.5}, {"weekday": 6, "hours": 8}], headers=auth)
    assert res.status_code == 200
    rows = {r["weekday"]: r["hours"] for r in res.get_json()}
    assert rows[0] == 1.5 and rows[6] == 8 and rows[1] == 3.0
    assert len(rows) == 7


def test_availability_validation(client, auth):
    assert_error(client.put("/api/availability", json=[{"weekday": 7, "hours": 2}], headers=auth), 400, "validation_error")
    assert_error(client.put("/api/availability", json=[{"weekday": 1, "hours": 25}], headers=auth), 400, "validation_error")
    assert_error(
        client.put("/api/availability", json=[{"weekday": 1, "hours": 2}, {"weekday": 1, "hours": 3}], headers=auth),
        400,
        "validation_error",
    )
