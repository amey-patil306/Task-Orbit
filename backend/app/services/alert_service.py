"""Builds in-app alerts from the workload engine. One alert per (kind, date)."""
from collections import defaultdict
from datetime import timedelta

from ..extensions import db
from ..models import Alert, Task
from ..utils.dates import local_day, local_today
from .availability_service import availability_map
from .workload_engine import daily_load, find_conflicts

WINDOW_DAYS = 14


def _short_list(titles, limit=3):
    shown = ", ".join(titles[:limit])
    return shown + (f" and {len(titles) - limit} more" if len(titles) > limit else "")


def desired_alerts(tasks, availability, today):
    """Return {(kind, date): (severity, message)} for the next 14 days."""
    end = today + timedelta(days=WINDOW_DAYS - 1)
    wanted = {}

    for row in daily_load(tasks, availability, today, end, today):
        if row["rule_label"] != "high":
            continue
        ratio = row["load_ratio"]
        severity = "critical" if ratio is None or ratio > 1.3 else "warning"
        wanted[("overload", row["date"])] = (
            severity, f"Overloaded: {row['hours_required']} h of work but only {row['hours_available']} h available.")

    titles = {t.id: t.title for t in tasks}
    for c in find_conflicts(tasks, today, WINDOW_DAYS):
        wanted[("collision", c["date"])] = (
            c["severity"], f"{c['reason']}: {_short_list([titles[i] for i in c['task_ids']])}.")

    # Deadline reminders: overdue + due today (one alert for today), due tomorrow (info).
    by_day = defaultdict(list)
    for t in tasks:
        if t.status != "done":
            by_day[local_day(t.due_date)].append(t.title)
    overdue = [title for day, items in by_day.items() if day < today for title in items]
    due_today = by_day.get(today, [])
    if overdue or due_today:
        parts = []
        if overdue:
            parts.append(f"Overdue: {_short_list(overdue)}")
        if due_today:
            parts.append(f"Due today: {_short_list(due_today)}")
        wanted[("deadline", today.isoformat())] = ("critical" if overdue else "warning", ". ".join(parts) + ".")
    tomorrow = today + timedelta(days=1)
    if by_day.get(tomorrow):
        wanted[("deadline", tomorrow.isoformat())] = ("info", f"Due tomorrow: {_short_list(by_day[tomorrow])}.")

    return wanted


def recompute_alerts(user_id: int) -> None:
    """Sync stored alerts (today onwards) with what the engine says now. Caller commits."""
    today = local_today()
    tasks = db.session.scalars(db.select(Task).where(Task.user_id == user_id, Task.status != "done")).all()
    wanted = desired_alerts(tasks, availability_map(user_id), today)

    existing = db.session.scalars(
        db.select(Alert).where(Alert.user_id == user_id, Alert.for_date >= today)
    ).all()
    for alert in existing:
        key = (alert.kind, alert.for_date.isoformat())
        if key not in wanted:
            db.session.delete(alert)  # the problem went away
            continue
        severity, message = wanted.pop(key)
        if message != alert.message:
            alert.is_read = False  # something changed, show it again
        alert.severity, alert.message = severity, message[:500]

    for (kind, day), (severity, message) in wanted.items():
        db.session.add(Alert(user_id=user_id, kind=kind, severity=severity, message=message[:500],
                             for_date=today.fromisoformat(day)))
