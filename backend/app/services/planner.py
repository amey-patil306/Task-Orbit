"""Smart study planner: priority score + greedy scheduler (pure functions).

(ASSUMED rules - see SPEC section 9.)

priority_score = 2 * priority + difficulty + 10 / (days_left + 1) + 3 if exam
Tasks are placed in deadline order (earliest due first), and the priority score
breaks ties between tasks due the same day. Earliest-deadline-first is used
because it never leaves a task out if some schedule could fit everything;
ordering by score alone lets far-away exams take today's hours from tomorrow's
deadline. Each task's remaining hours go on the earliest days that still have
free study time, between its start date and due date, with at most 3 hours of
one task per day (that cap is lifted in a second pass if the task would
otherwise not fit). Whatever does not fit is returned as "unscheduled", with
suggestions.
"""
from datetime import date, timedelta

from ..utils.dates import local_day
from .workload_engine import daterange

MAX_HOURS_PER_TASK_PER_DAY = 3.0
MIN_SESSION_HOURS = 0.25


def priority_score(task, today: date) -> float:
    days_left = max((local_day(task.due_date) - today).days, 0)
    urgency = 10 / (days_left + 1)
    exam_bonus = 3 if task.type == "exam" else 0
    return round(2 * task.priority + task.difficulty + urgency + exam_bonus, 2)


def build_plan(tasks, availability: dict, today: date, horizon_days: int = 14, done_hours: dict | None = None):
    """Returns (sessions, unscheduled). done_hours = hours already studied per task id."""
    done_hours = done_hours or {}
    end = today + timedelta(days=horizon_days - 1)
    free = {d: float(availability.get(d.weekday(), 0.0)) for d in daterange(today, end)}

    candidates = [t for t in tasks if t.status != "done" and local_day(t.due_date) <= end]
    candidates.sort(key=lambda t: (max(local_day(t.due_date), today), -priority_score(t, today)))

    sessions, unscheduled = [], []
    for task in candidates:
        left = max(float(task.estimated_hours) - done_hours.get(task.id, 0.0), 0.0)
        if left <= 0:
            continue
        last = max(local_day(task.due_date), today)  # overdue tasks: do them today
        first = max(today, task.start_date or today)
        if first > last:
            first = last

        planned = {}
        for cap in (MAX_HOURS_PER_TASK_PER_DAY, float("inf")):
            for day in daterange(first, last):
                if left < MIN_SESSION_HOURS:
                    break
                room = min(free[day], cap - planned.get(day, 0.0))
                hours = round(min(left, room), 2)
                if hours < MIN_SESSION_HOURS:
                    continue
                planned[day] = planned.get(day, 0.0) + hours
                free[day] -= hours
                left -= hours

        for day in sorted(planned):
            sessions.append({"task_id": task.id, "planned_date": day, "planned_hours": round(planned[day], 2)})
        if left >= MIN_SESSION_HOURS:
            unscheduled.append({
                "task_id": task.id,
                "title": task.title,
                "due_date": local_day(task.due_date).isoformat(),
                "hours_left": round(left, 1),
                "priority_score": priority_score(task, today),
            })

    return sessions, unscheduled


def suggestions_for(unscheduled: list[dict], today: date) -> list[str]:
    tips = []
    for item in unscheduled:
        due = date.fromisoformat(item["due_date"])
        days_left = (due - today).days
        if days_left <= 1:
            tips.append(f"\"{item['title']}\" is due very soon and still needs {item['hours_left']} h. "
                        "Ask your teacher for an extension or drop lower-priority work today.")
        else:
            tips.append(f"\"{item['title']}\" needs {item['hours_left']} more hours before {due.strftime('%d %b')}. "
                        "Add study hours in Settings for the days before it, or start it earlier.")
    if len(unscheduled) >= 3:
        tips.append("Several tasks don't fit. Look at your weekly availability - even one extra hour a day helps.")
    return tips
