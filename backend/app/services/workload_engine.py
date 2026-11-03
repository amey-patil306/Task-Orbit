"""Rule-based workload engine (pure functions, no database access).

(ASSUMED rules - see SPEC section 9. Replace when the original section is recovered.)

Daily load:
  Each open task's estimated hours are spread evenly over the days from
  max(today, start_date) to its due day. Overdue tasks put all their hours on today.
  load_ratio = hours_required / hours_available
  rule_label: low (< 0.7), medium (0.7 - 1.0), high (> 1.0)

Conflicts:
  Two or more open tasks due on the same day in the next 14 days.
  Severity is critical for 3+ deadlines or if one of them is an exam, otherwise warning.
"""
from collections import defaultdict
from datetime import date, timedelta

from ..utils.dates import local_day

LOW_MAX = 0.7
MEDIUM_MAX = 1.0


def daterange(start: date, end: date):
    day = start
    while day <= end:
        yield day
        day += timedelta(days=1)


def rule_label(ratio):
    if ratio is None:  # work due on a day with zero study hours
        return "high"
    if ratio < LOW_MAX:
        return "low"
    if ratio <= MEDIUM_MAX:
        return "medium"
    return "high"


def spread_task(task, today: date) -> dict:
    """How many hours of this task fall on each day."""
    if task.status == "done":
        return {}
    due_day = local_day(task.due_date)
    if due_day < today:
        return {today: float(task.estimated_hours)}
    first = max(today, task.start_date or today)
    if first > due_day:
        first = due_day
    days = list(daterange(first, due_day))
    share = float(task.estimated_hours) / len(days)
    return {d: share for d in days}


def daily_load(tasks, availability: dict, start: date, end: date, today: date) -> list[dict]:
    """One row per day: hours required vs available. `availability` maps weekday (Mon=0) -> hours."""
    required = defaultdict(float)
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


def workload_summary(tasks, availability: dict, today: date, days: int = 7) -> dict:
    """Short summary returned after a task is created or edited: the next `days` days."""
    end = today + timedelta(days=days - 1)
    rows = daily_load(tasks, availability, today, end, today)
    return {
        "from": today.isoformat(),
        "to": end.isoformat(),
        "days": rows,
        "overloaded_days": sum(1 for r in rows if r["rule_label"] == "high"),
    }


def find_conflicts(tasks, today: date, days: int = 14) -> list[dict]:
    """Days in the next `days` days where two or more open deadlines collide."""
    end = today + timedelta(days=days - 1)
    by_day = defaultdict(list)
    for task in tasks:
        if task.status == "done":
            continue
        day = local_day(task.due_date)
        if today <= day <= end:
            by_day[day].append(task)

    conflicts = []
    for day in sorted(by_day):
        group = by_day[day]
        if len(group) < 2:
            continue
        has_exam = any(t.type == "exam" for t in group)
        reason = f"{len(group)} deadlines on the same day" + (" including an exam" if has_exam else "")
        conflicts.append({
            "date": day.isoformat(),
            "task_ids": [t.id for t in group],
            "reason": reason,
            "severity": "critical" if len(group) >= 3 or has_exam else "warning",
        })
    return conflicts
