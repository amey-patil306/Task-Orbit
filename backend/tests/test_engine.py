"""Tests for the (ASSUMED) rule engine. Section 14's official cases get added here once recovered."""
from datetime import date, datetime
from types import SimpleNamespace

from app.services.workload_engine import daily_load, rule_label, spread_task, workload_summary

TODAY = date(2026, 11, 2)  # a Monday
AVAIL = {0: 3, 1: 3, 2: 3, 3: 3, 4: 3, 5: 5, 6: 5}


def task(hours, due, start=None, status="todo"):
    return SimpleNamespace(estimated_hours=hours, due_date=datetime.combine(due, datetime.min.time()), start_date=start, status=status)


def test_rule_label_thresholds():
    assert rule_label(0.0) == "low"
    assert rule_label(0.69) == "low"
    assert rule_label(0.7) == "medium"
    assert rule_label(1.0) == "medium"
    assert rule_label(1.01) == "high"
    assert rule_label(None) == "high"


def test_spread_evenly_to_due_day():
    spread = spread_task(task(6, date(2026, 11, 4)), TODAY)
    assert spread == {date(2026, 11, 2): 2.0, date(2026, 11, 3): 2.0, date(2026, 11, 4): 2.0}


def test_spread_respects_future_start_date():
    spread = spread_task(task(4, date(2026, 11, 5), start=date(2026, 11, 4)), TODAY)
    assert spread == {date(2026, 11, 4): 2.0, date(2026, 11, 5): 2.0}


def test_overdue_task_lands_on_today():
    assert spread_task(task(3, date(2026, 10, 30)), TODAY) == {TODAY: 3.0}


def test_done_task_adds_nothing():
    assert spread_task(task(3, date(2026, 11, 5), status="done"), TODAY) == {}


def test_daily_load_sums_tasks_and_labels():
    rows = daily_load([task(3, TODAY), task(1.5, TODAY)], AVAIL, TODAY, date(2026, 11, 3), TODAY)
    assert rows[0] == {"date": "2026-11-02", "hours_required": 4.5, "hours_available": 3.0, "load_ratio": 1.5, "rule_label": "high"}
    assert rows[1]["hours_required"] == 0.0 and rows[1]["rule_label"] == "low"


def test_zero_availability():
    avail = {**AVAIL, 0: 0}
    busy = daily_load([task(1, TODAY)], avail, TODAY, TODAY, TODAY)[0]
    free = daily_load([], avail, TODAY, TODAY, TODAY)[0]
    assert busy["load_ratio"] is None and busy["rule_label"] == "high"
    assert free["load_ratio"] == 0.0 and free["rule_label"] == "low"


def test_summary_counts_overloaded_days():
    summary = workload_summary([task(8, TODAY)], AVAIL, TODAY)
    assert summary["from"] == "2026-11-02" and summary["to"] == "2026-11-08"
    assert len(summary["days"]) == 7
    assert summary["overloaded_days"] == 1
