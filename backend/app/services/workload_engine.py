"""Rule-based workload engine: pure functions, no database or Flask access.

(ASSUMED, see SPEC section 9 - replace with the original rules when that section is recovered.)

Rule: each open task's estimated hours are spread evenly over the days from
max(today, start_date) to its due day (inclusive). Overdue open tasks put all their
hours on today (backlog). Load ratio = hours_required / hours_available, and the label
uses the same thresholds as the heatmap: low < 0.7 <= medium <= 1.0 < high.
"""
from collections import defaultdict
from datetime import date, timedelta

LOW_MAX = 0.7
MEDIUM_MAX = 1.0


def daterange(start: date, end: date):
    day = start
    while day <= end:
        yield day
        day += timedelta(days=1)


def rule_label(ratio: float | None) -> str:
    if ratio is None:  # work required on a day with zero available hours
        return "high"
    if ratio < LOW_MAX:
        return "low"
    if ratio <= MEDIUM_MAX:
        return "medium"
    return "high"


def spread_task(task, today: date) -> dict[date, float]:
    """Hours per day for one task. `task` needs status, estimated_hours, start_date, due_date."""
    if task.status == "done":
        return {}
    due_day = task.due_date.date() if hasattr(task.due_date, "date") else task.due_date
    if due_day < today:
        return {today: float(task.estimated_hours)}
    first = max(today, task.start_date or today)
    if first > due_day:  # start date after due date: treat as due-day work
        first = due_day
    days = list(daterange(first, due_day))
    share = float(task.estimated_hours) / len(days)
    return {d: share for d in days}


def daily_load(tasks, availability: dict[int, float], start: date, end: date, today: date) -> list[dict]:
    """Daily load rows for [start, end]. `availability` maps weekday (Mon=0) -> hours."""
    required: dict[date, float] = defaultdict(float)
    for task in tasks:
        for day, hours in spread_task(task, today).items():
            required[day] += hours

    rows = []
    for day in daterange(start, end):
        need = round(required.get(day, 0.0), 2)
        have = float(availability.get(day.weekday(), 0.0))
        if have > 0:
            ratio = round(need / have, 2)
        else:
            ratio = 0.0 if need == 0 else None
        rows.append({
            "date": day.isoformat(),
            "hours_required": need,
            "hours_available": have,
            "load_ratio": ratio,
            "rule_label": rule_label(ratio),
        })
    return rows


def workload_summary(tasks, availability: dict[int, float], today: date, days: int = 7) -> dict:
    """Short summary returned after task mutations: the next `days` days."""
    end = today + timedelta(days=days - 1)
    rows = daily_load(tasks, availability, today, end, today)
    return {
        "from": today.isoformat(),
        "to": end.isoformat(),
        "days": rows,
        "overloaded_days": sum(1 for r in rows if r["rule_label"] == "high"),
    }
