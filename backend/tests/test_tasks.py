from datetime import timedelta

import pytest

from app.utils.dates import utcnow
from tests.test_api import assert_error


def _iso(days_from_now: int, hour: int = 17) -> str:
    d = utcnow().date() + timedelta(days=days_from_now)
    return f"{d.isoformat()}T{hour:02d}:00:00"


def _make(client, headers, **kw):
    body = {"title": "Lab report", "type": "practical", "estimated_hours": 4, "due_date": _iso(3)}
    body.update(kw)
    res = client.post("/api/tasks", json=body, headers=headers)
    assert res.status_code == 201, res.get_json()
    return res.get_json()


def test_create_returns_task_and_summary(client, auth):
    body = _make(client, auth, difficulty=4, priority=5)
    task = body["task"]
    assert task["title"] == "Lab report"
    assert task["status"] == "todo" and task["completed_at"] is None
    assert task["due_date"].endswith("Z")

    summary = body["workload_summary"]
    assert len(summary["days"]) == 7
    # 4 hours spread over 4 days (today..due) = 1 h/day
    assert summary["days"][0]["hours_required"] == 1.0
    assert summary["days"][4]["hours_required"] == 0.0


def test_create_defaults_and_date_only_due(client, auth):
    task = _make(client, auth, due_date=utcnow().date().isoformat())["task"]
    assert task["difficulty"] == 3 and task["priority"] == 3 and task["type"] == "practical"


def test_timezone_offset_is_converted_to_utc(client, auth):
    d = (utcnow().date() + timedelta(days=5)).isoformat()
    task = _make(client, auth, due_date=f"{d}T17:00:00+05:30")["task"]
    assert task["due_date"] == f"{d}T11:30:00Z"


@pytest.mark.parametrize("bad, field", [
    ({"title": ""}, "title"),
    ({"type": "holiday"}, "type"),
    ({"difficulty": 6}, "difficulty"),
    ({"priority": 0}, "priority"),
    ({"estimated_hours": 0}, "estimated_hours"),
    ({"due_date": "next friday"}, "due_date"),
])
def test_create_validation(client, auth, bad, field):
    body = {"title": "T", "estimated_hours": 2, "due_date": _iso(2)}
    body.update(bad)
    err = assert_error(client.post("/api/tasks", json=body, headers=auth), 400, "validation_error")
    assert field in err["fields"]


def test_create_requires_title_hours_due(client, auth):
    err = assert_error(client.post("/api/tasks", json={}, headers=auth), 400, "validation_error")
    assert {"title", "estimated_hours", "due_date"} <= set(err["fields"])


def test_start_date_after_due_is_rejected(client, auth):
    start = (utcnow().date() + timedelta(days=5)).isoformat()
    assert_error(client.post("/api/tasks", json={"title": "T", "estimated_hours": 2, "due_date": _iso(2), "start_date": start},
                             headers=auth), 400, "validation_error")


def test_subject_must_belong_to_user(client, register):
    a, _ = register("a@example.com")
    b, _ = register("b@example.com")
    sid = client.post("/api/subjects", json={"name": "Maths"}, headers=a).get_json()["id"]
    err = assert_error(client.post("/api/tasks", json={"title": "T", "estimated_hours": 1, "due_date": _iso(1), "subject_id": sid},
                                   headers=b), 400, "validation_error")
    assert "subject_id" in err["fields"]
    assert _make(client, a, subject_id=sid)["task"]["subject_id"] == sid


def test_list_filters(client, auth):
    sid = client.post("/api/subjects", json={"name": "DBMS"}, headers=auth).get_json()["id"]
    _make(client, auth, title="A", type="exam", due_date=_iso(1), subject_id=sid)
    _make(client, auth, title="B", type="assignment", due_date=_iso(5))
    c = _make(client, auth, title="C", type="exam", due_date=_iso(10))["task"]
    client.patch(f"/api/tasks/{c['id']}/complete", json={"actual_hours": 3}, headers=auth)

    def titles(qs=""):
        res = client.get(f"/api/tasks{qs}", headers=auth)
        assert res.status_code == 200, res.get_json()
        return [t["title"] for t in res.get_json()]

    assert titles() == ["A", "B", "C"]  # ordered by due date
    assert titles("?type=exam") == ["A", "C"]
    assert titles("?status=done") == ["C"]
    assert titles(f"?subject_id={sid}") == ["A"]
    d5 = (utcnow().date() + timedelta(days=5)).isoformat()
    assert titles(f"?from={d5}&to={d5}") == ["B"]  # 'to' is inclusive of the whole day
    assert titles(f"?from={d5}") == ["B", "C"]


def test_list_filter_validation(client, auth):
    assert_error(client.get("/api/tasks?status=lost", headers=auth), 400, "validation_error")
    assert_error(client.get("/api/tasks?from=2026-12-10&to=2026-12-01", headers=auth), 400, "validation_error")


def test_update_partial(client, auth):
    task = _make(client, auth)["task"]
    res = client.put(f"/api/tasks/{task['id']}", json={"priority": 5, "description": "Chapter 3"}, headers=auth)
    assert res.status_code == 200
    body = res.get_json()
    assert body["task"]["priority"] == 5
    assert body["task"]["description"] == "Chapter 3"
    assert body["task"]["title"] == "Lab report"  # untouched
    assert "workload_summary" in body


def test_update_rejects_null_required_field(client, auth):
    task = _make(client, auth)["task"]
    assert_error(client.put(f"/api/tasks/{task['id']}", json={"title": None}, headers=auth), 400, "validation_error")


def test_update_start_after_existing_due_is_rejected(client, auth):
    task = _make(client, auth, due_date=_iso(2))["task"]
    start = (utcnow().date() + timedelta(days=4)).isoformat()
    assert_error(client.put(f"/api/tasks/{task['id']}", json={"start_date": start}, headers=auth), 400, "validation_error")


def test_status_change_sets_and_clears_completed_at(client, auth):
    task = _make(client, auth)["task"]
    done = client.put(f"/api/tasks/{task['id']}", json={"status": "done"}, headers=auth).get_json()["task"]
    assert done["completed_at"] is not None
    reopened = client.put(f"/api/tasks/{task['id']}", json={"status": "in_progress"}, headers=auth).get_json()["task"]
    assert reopened["completed_at"] is None


def test_complete_logs_actual_hours(client, auth):
    task = _make(client, auth)["task"]
    res = client.patch(f"/api/tasks/{task['id']}/complete", json={"actual_hours": 5.5}, headers=auth)
    assert res.status_code == 200
    done = res.get_json()
    assert done["status"] == "done" and done["actual_hours"] == 5.5 and done["completed_at"]

    assert_error(client.patch(f"/api/tasks/{task['id']}/complete", json={}, headers=auth), 400, "validation_error")
    assert_error(client.patch(f"/api/tasks/{task['id']}/complete", json={"actual_hours": -1}, headers=auth), 400)


def test_completed_task_leaves_summary(client, auth):
    task = _make(client, auth)["task"]
    client.patch(f"/api/tasks/{task['id']}/complete", json={"actual_hours": 4}, headers=auth)
    other = _make(client, auth, estimated_hours=1, due_date=_iso(0))
    assert other["workload_summary"]["days"][0]["hours_required"] == 1.0


def test_delete(client, auth):
    task = _make(client, auth)["task"]
    assert client.delete(f"/api/tasks/{task['id']}", headers=auth).status_code == 204
    assert client.get("/api/tasks", headers=auth).get_json() == []
    assert_error(client.delete(f"/api/tasks/{task['id']}", headers=auth), 404)


def test_other_users_task_is_404(client, register):
    a, _ = register("a@example.com")
    b, _ = register("b@example.com")
    task = _make(client, a)["task"]
    tid = task["id"]
    assert_error(client.put(f"/api/tasks/{tid}", json={"title": "x"}, headers=b), 404, "not_found")
    assert_error(client.patch(f"/api/tasks/{tid}/complete", json={"actual_hours": 1}, headers=b), 404)
    assert_error(client.delete(f"/api/tasks/{tid}", headers=b), 404)
    assert client.get("/api/tasks", headers=b).get_json() == []
