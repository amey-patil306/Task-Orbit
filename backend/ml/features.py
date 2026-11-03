"""The ONE place feature logic lives (SPEC section 6).

Training (generate_dataset.py / train.py) and the live API (app/services/ml_service.py) both
call these functions, so a model sees exactly the same numbers in production as in training.

All functions take "task-like" objects with: status, estimated_hours, difficulty, type,
start_date, due_date (naive UTC datetime), assignment_id, and for finished tasks actual_hours
and is_late. Database Task rows and the simulator's SimpleNamespace tasks both fit.
"""
from datetime import date, timedelta

from app.services.workload_engine import daily_load
from app.utils.dates import local_day

RATIO_CAP = 3.0
TASK_TYPES = ["assignment", "practical", "exam", "project", "other"]


def _cap(ratio):
    return RATIO_CAP if ratio is None else min(float(ratio), RATIO_CAP)


def user_speed_ratio(done_tasks) -> float:
    """How much longer than estimated this student really takes (1.0 = on estimate, 1.0 if unknown)."""
    pairs = [(t.actual_hours, t.estimated_hours) for t in done_tasks if t.actual_hours and t.estimated_hours]
    if len(pairs) < 2:
        return 1.0
    return round(sum(a for a, _ in pairs) / sum(e for _, e in pairs), 3)


# ---------------------------------------------------------------- Model A: overload per day

OVERLOAD_FEATURES = [
    "days_ahead", "weekday",
    "n_due_3d", "n_due_7d", "hours_due_3d", "hours_due_7d",
    "avg_difficulty", "max_difficulty", "exam_within_7d",
    "avail_hours_3d", "avail_hours_7d",
    "hours_required_day", "rule_ratio_day", "rule_ratio_3d", "rule_ratio_7d",
    "backlog_hours", "user_speed_ratio", "class_ratio_7d",
]


def overload_features(open_tasks, availability: dict, today: date, days: int = 7, speed_ratio: float = 1.0,
                      class_ratio: dict | None = None):
    """Feature rows for each of the next `days` days, as seen from `today` (only what the app can see).

    class_ratio = {assignment_id: classmates' average actual / expected hours so far} for assignments
    some classmates have already finished (missing = no information yet).
    """
    class_ratio = class_ratio or {}
    open_tasks = [t for t in open_tasks if t.status != "done"]
    end = today + timedelta(days=days + 6)
    rows = {r["date"]: r for r in daily_load(open_tasks, availability, today, end, today)}
    backlog = sum(float(t.estimated_hours) for t in open_tasks if local_day(t.due_date) <= today)

    out = []
    for k in range(days):
        day = today + timedelta(days=k)

        def window(n):
            ds = [(day + timedelta(days=i)).isoformat() for i in range(n)]
            need = sum(rows[d]["hours_required"] for d in ds)
            have = sum(rows[d]["hours_available"] for d in ds)
            return need, have

        def due_within(n):
            return [t for t in open_tasks if 0 <= (local_day(t.due_date) - day).days < n]

        due3, due7 = due_within(3), due_within(7)
        need3, have3 = window(3)
        need7, have7 = window(7)
        out.append({
            "date": day.isoformat(),
            "days_ahead": k,
            "weekday": day.weekday(),
            "n_due_3d": len(due3),
            "n_due_7d": len(due7),
            "hours_due_3d": round(sum(t.estimated_hours * t.difficulty / 3 for t in due3), 2),
            "hours_due_7d": round(sum(t.estimated_hours * t.difficulty / 3 for t in due7), 2),
            "avg_difficulty": round(sum(t.difficulty for t in due7) / len(due7), 2) if due7 else 0.0,
            "max_difficulty": max((t.difficulty for t in due7), default=0),
            "exam_within_7d": int(any(t.type == "exam" for t in due7)),
            "avail_hours_3d": have3,
            "avail_hours_7d": have7,
            "hours_required_day": rows[day.isoformat()]["hours_required"],
            "rule_ratio_day": _cap(rows[day.isoformat()]["load_ratio"]),
            "rule_ratio_3d": _cap(need3 / have3) if have3 else RATIO_CAP,
            "rule_ratio_7d": _cap(need7 / have7) if have7 else RATIO_CAP,
            "backlog_hours": round(backlog, 2),
            "user_speed_ratio": speed_ratio,
            "class_ratio_7d": _hours_weighted_ratio(due7, class_ratio),
            "rule_label": rows[day.isoformat()]["rule_label"],  # baseline, not a model input
        })
    return out


def _hours_weighted_ratio(tasks, class_ratio: dict) -> float:
    """How long classmates really took vs expected, over these tasks (1.0 where unknown), weighted by hours."""
    total = sum(float(t.estimated_hours) for t in tasks)
    if not total:
        return 1.0
    return round(sum(float(t.estimated_hours) * class_ratio.get(t.assignment_id, 1.0) for t in tasks) / total, 3)


# ---------------------------------------------------------------- Model B: real hours for a task

TIME_FEATURES = ["estimated_hours", "difficulty", "user_speed_ratio", "class_avg_ratio", "class_done"] + \
    [f"type_{t}" for t in TASK_TYPES]


def time_features(task, speed_ratio: float = 1.0, class_avg_ratio: float | None = None, class_done: int = 0) -> dict:
    """class_avg_ratio = classmates' average (actual / teacher's expected hours) on the same assignment."""
    row = {
        "estimated_hours": float(task.estimated_hours),
        "difficulty": task.difficulty,
        "user_speed_ratio": speed_ratio,
        "class_avg_ratio": class_avg_ratio if class_avg_ratio is not None else 1.0,
        "class_done": class_done,
    }
    row.update({f"type_{t}": int(task.type == t) for t in TASK_TYPES})
    return row


# ---------------------------------------------------------------- Model C: will this task be late?

RISK_FEATURES = [
    "days_left", "difficulty", "estimated_hours", "started",
    "late_rate", "n_past", "user_speed_ratio",
    "overloaded_days_7d", "peak_ratio_7d", "open_tasks", "overdue_tasks",
    "stress", "has_stress",
]


def risk_features(task, open_tasks, done_tasks, availability: dict, today: date, stress: int | None) -> dict:
    """Features for one open teacher task, as of `today`."""
    open_tasks = [t for t in open_tasks if t.status != "done"]
    rows = daily_load(open_tasks, availability, today, today + timedelta(days=6), today)
    graded = [t for t in done_tasks if t.assignment_id]
    return {
        "days_left": (local_day(task.due_date) - today).days,
        "difficulty": task.difficulty,
        "estimated_hours": float(task.estimated_hours),
        "started": int(task.status == "in_progress"),
        "late_rate": round(sum(bool(t.is_late) for t in graded) / len(graded), 3) if graded else 0.1,
        "n_past": len(graded),
        "user_speed_ratio": user_speed_ratio(done_tasks),
        "overloaded_days_7d": sum(r["rule_label"] == "high" for r in rows),
        "peak_ratio_7d": max(_cap(r["load_ratio"]) for r in rows),
        "open_tasks": len(open_tasks),
        "overdue_tasks": sum(local_day(t.due_date) < today for t in open_tasks),
        "stress": stress or 0,
        "has_stress": int(stress is not None),
    }
