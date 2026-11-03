"""Teacher-side analytics (PLAN_V2 section 3): class workload, Smart Deadline Advisor,
early-warning risk, assignment stats, insights, and evidence for extension requests.

Everything is built on the same rule engine students use (workload_engine), so a teacher
and a student always see the same numbers.
"""
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from statistics import mean
from types import SimpleNamespace

from ..extensions import db
from ..models import Assignment, Availability, CheckIn, Classroom, ExtensionRequest, Task, User
from ..models.availability import DEFAULT_HOURS
from ..utils.dates import LOCAL_OFFSET, iso_datetime, local_day, local_today
from .workload_engine import daily_load, daterange, find_conflicts, spread_task

OVERLOAD_RATIO_CAP = 3.0  # how a "no free time at all" day counts in averages


# ---------------------------------------------------------------- loading data

def load_context(student_ids: list[int]) -> dict:
    """{student_id: {"open": [tasks], "done": [tasks], "avail": {weekday: hours}}} in 3 queries."""
    ctx = {sid: {"open": [], "done": [], "avail": dict(DEFAULT_HOURS)} for sid in student_ids}
    if not student_ids:
        return ctx
    for task in db.session.scalars(db.select(Task).where(Task.user_id.in_(student_ids))):
        ctx[task.user_id]["done" if task.status == "done" else "open"].append(task)
    for a in db.session.scalars(db.select(Availability).where(Availability.user_id.in_(student_ids))):
        ctx[a.user_id]["avail"][a.weekday] = a.hours
    return ctx


def _ratio(value):
    return OVERLOAD_RATIO_CAP if value is None else min(value, OVERLOAD_RATIO_CAP)


def _due_at(day: date) -> datetime:
    """Naive-UTC datetime for midday IST on `day` (used for what-if tasks)."""
    return datetime.combine(day, time(12)) - LOCAL_OFFSET


def _week_start(day: date) -> date:
    return day - timedelta(days=day.weekday())


# ---------------------------------------------------------------- class heatmap

def class_heatmap(ctx: dict, today: date, days: int = 28) -> list[dict]:
    """Per day: average load ratio, % of students overloaded, number of distinct deadlines."""
    end = today + timedelta(days=days - 1)
    per_day = defaultdict(list)
    for data in ctx.values():
        for row in daily_load(data["open"], data["avail"], today, end, today):
            per_day[row["date"]].append(row)

    deadlines = defaultdict(set)
    for data in ctx.values():
        for t in data["open"]:
            key = f"a{t.assignment_id}" if t.assignment_id else f"t{t.id}"
            deadlines[local_day(t.due_date).isoformat()].add(key)

    out = []
    for day in daterange(today, end):
        rows = per_day.get(day.isoformat(), [])
        n = len(rows) or 1
        out.append({
            "date": day.isoformat(),
            "avg_ratio": round(mean(_ratio(r["load_ratio"]) for r in rows), 2) if rows else 0.0,
            "pct_overloaded": round(sum(r["rule_label"] == "high" for r in rows) / n, 2),
            "avg_hours_required": round(mean(r["hours_required"] for r in rows), 1) if rows else 0.0,
            "deadlines": len(deadlines.get(day.isoformat(), ())),
        })
    return out


# ---------------------------------------------------------------- Smart Deadline Advisor

def _assignment_clashes(ctx: dict, day: date, exclude_assignment_id: int | None) -> list[dict]:
    """Other teacher assignments the same students already have due on `day`."""
    found = {}
    for data in ctx.values():
        for t in data["open"]:
            if not t.assignment_id or t.assignment_id == exclude_assignment_id or local_day(t.due_date) != day:
                continue
            item = found.setdefault(t.assignment_id, {
                "assignment_id": t.assignment_id,
                "title": t.assignment.title,
                "classroom": t.assignment.classroom.name,
                "type": t.type,
                "students": 0,
            })
            item["students"] += 1
    return sorted(found.values(), key=lambda c: -c["students"])


def _impact(ctx, today, due_day, window_days, expected_hours, exclude_assignment_id):
    start = max(today, due_day - timedelta(days=window_days))
    what_if = SimpleNamespace(id=-1, status="todo", estimated_hours=expected_hours,
                              start_date=start, due_date=_due_at(due_day), type="assignment")
    overloaded, peaks = 0, []
    for data in ctx.values():
        tasks = [t for t in data["open"] if t.assignment_id != exclude_assignment_id] + [what_if]
        rows = daily_load(tasks, data["avail"], start, due_day, today)
        peak = max((_ratio(r["load_ratio"]) for r in rows), default=0.0)
        peaks.append(peak)
        overloaded += any(r["rule_label"] == "high" for r in rows)

    n = len(ctx) or 1
    clashes = _assignment_clashes(ctx, due_day, exclude_assignment_id)
    pct = round(overloaded / n, 2)
    score = round(pct + 0.15 * len(clashes) + (0.1 if due_day.weekday() == 6 else 0), 3)
    if pct < 0.2 and not clashes:
        verdict = "good"
    elif pct < 0.5 and len(clashes) <= 1:
        verdict = "risky"
    else:
        verdict = "bad"
    return {
        "date": due_day.isoformat(),
        "pct_overloaded": pct,
        "avg_peak_ratio": round(mean(peaks), 2) if peaks else 0.0,
        "clashes": clashes,
        "verdict": verdict,
        "score": score,
    }


def deadline_advice(classroom: Classroom, expected_hours: float, due_date: datetime,
                    start_date: date | None = None, exclude_assignment_id: int | None = None) -> dict:
    """How a proposed deadline would hit the class, plus up to 3 better dates."""
    today = local_today()
    due_day = local_day(due_date)
    window_days = max(1, (due_day - start_date).days) if start_date else 7
    ctx = load_context(classroom.student_ids())

    if not ctx:
        return {"students": 0, "proposed": None, "alternatives": [],
                "message": "No students have joined this class yet, so there is nothing to compare."}

    proposed = _impact(ctx, today, due_day, window_days, expected_hours, exclude_assignment_id)
    candidates = []
    for offset in range(-3, 8):
        day = due_day + timedelta(days=offset)
        if offset == 0 or day <= today:
            continue
        candidates.append(_impact(ctx, today, day, window_days, expected_hours, exclude_assignment_id))
    better = sorted((c for c in candidates if c["score"] < proposed["score"]), key=lambda c: (c["score"], c["date"]))

    if proposed["verdict"] == "good":
        message = "Good date: most of the class has room for this."
    elif better:
        message = f"{round(proposed['pct_overloaded'] * 100)}% of the class would be overloaded. Consider {better[0]['date']}."
    else:
        message = "This is a heavy period for the class, but nearby dates are not better."
    return {"students": len(ctx), "proposed": proposed, "alternatives": better[:3], "message": message}


# ---------------------------------------------------------------- early-warning risk (rules; Model C later)

def student_risk(data: dict, today: date, latest_stress: int | None) -> dict:
    """Risk of missing deadlines, with human-readable reasons. Rule-based until Model C is trained."""
    score, reasons = 0, []

    overdue = [t for t in data["open"] if local_day(t.due_date) < today]
    if overdue:
        score += min(6, 3 * len(overdue))
        reasons.append(f"{len(overdue)} overdue task{'s' if len(overdue) > 1 else ''}")

    rows = daily_load(data["open"], data["avail"], today, today + timedelta(days=6), today)
    high_days = sum(r["rule_label"] == "high" for r in rows)
    if high_days:
        score += min(3, high_days)
        reasons.append(f"overloaded on {high_days} of the next 7 days")

    not_started = [t for t in data["open"] if t.assignment_id and t.status == "todo"
                   and 0 <= (local_day(t.due_date) - today).days <= 1]
    if not_started:
        score += min(3, len(not_started))
        reasons.append(f"{len(not_started)} assignment{'s' if len(not_started) > 1 else ''} due by tomorrow not started")

    graded = [t for t in data["done"] if t.assignment_id]
    if len(graded) >= 3:
        late_rate = sum(t.is_late for t in graded) / len(graded)
        if late_rate >= 0.3:
            score += 3
            reasons.append(f"submitted {round(late_rate * 100)}% of past work late")
        elif late_rate >= 0.15:
            score += 1
            reasons.append(f"some late submissions ({round(late_rate * 100)}%)")

    if latest_stress and latest_stress >= 4:
        score += 2
        reasons.append(f"reported high stress ({latest_stress}/5)")

    level = "high" if score >= 6 else "medium" if score >= 3 else "low"
    result = {"risk": level, "score": score, "reasons": reasons, "overloaded_days_7d": high_days,
              "open_tasks": len(data["open"]), "overdue": len(overdue), "risk_source": "rules", "late_probability": None}

    # Model C: chance of submitting each teacher task due in the next 3 days late (the window it was trained on).
    from . import ml_service  # noqa: PLC0415

    probs = []
    for t in data["open"]:
        if t.assignment_id and 0 <= (local_day(t.due_date) - today).days <= 3:
            p = ml_service.late_probability(t, data["open"], data["done"], data["avail"], today, latest_stress)
            if p is None:
                return result  # model not loaded: keep the rule-based answer
            probs.append((p, t))
    if probs:
        p, t = max(probs, key=lambda x: x[0])
        result.update(
            risk="high" if p >= ML_HIGH else "medium" if p >= ML_MEDIUM else "low",
            score=round(p * 10, 1), risk_source="ml", late_probability=round(p, 2),
            reasons=[f"ML: {round(p * 100)}% chance \"{t.title}\" is submitted late"] + reasons,
        )
    return result


# Model C was trained with balanced class weights, so its probabilities run high. Cut-offs picked on
# held-out students (base late rate 26%): >= 0.60 flags ~22%, of whom 50% really are late
# (about 2x the base rate); >= 0.50 flags ~38% with 42% precision. See notebooks/task_orbit_ml.ipynb.
ML_HIGH = 0.6
ML_MEDIUM = 0.5


def latest_stress(student_ids: list[int]) -> dict:
    """Most recent check-in (from the last 2 weeks) per student."""
    since = _week_start(local_today()) - timedelta(days=7)
    out = {}
    rows = db.session.scalars(db.select(CheckIn).where(CheckIn.user_id.in_(student_ids), CheckIn.week_start >= since)
                              .order_by(CheckIn.week_start))
    for c in rows:
        out[c.user_id] = c.stress
    return out


def roster_with_risk(classroom: Classroom, ctx: dict | None = None) -> list[dict]:
    ids = classroom.student_ids()
    ctx = ctx or load_context(ids)
    stress = latest_stress(ids)
    today = local_today()
    users = {u.id: u for u in db.session.scalars(db.select(User).where(User.id.in_(ids)))} if ids else {}
    roster = []
    for sid in ids:
        u = users[sid]
        roster.append({"id": sid, "name": u.name, "email": u.email, "division": u.division,
                       "latest_stress": stress.get(sid), **student_risk(ctx[sid], today, stress.get(sid))})
    order = {"high": 0, "medium": 1, "low": 2}
    return sorted(roster, key=lambda r: (order[r["risk"]], -r["score"], r["name"]))


# ---------------------------------------------------------------- assignment stats

def assignment_stats(assignment: Assignment, with_students: bool = False) -> dict:
    tasks = assignment.tasks.all()
    done = [t for t in tasks if t.status == "done"]
    actuals = [t.actual_hours for t in done if t.actual_hours]
    avg_actual = round(mean(actuals), 1) if actuals else None
    today = local_today()
    stats = {
        **assignment.to_dict(),
        "students": len(tasks),
        "done": len(done),
        "in_progress": sum(t.status == "in_progress" for t in tasks),
        "not_started": sum(t.status == "todo" for t in tasks),
        "late": sum(t.is_late for t in done) + sum(
            1 for t in tasks if t.status != "done" and local_day(t.due_date) < today),
        "completion_rate": round(len(done) / len(tasks), 2) if tasks else 0.0,
        "avg_actual_hours": avg_actual,
        "hours_ratio": round(avg_actual / assignment.expected_hours, 2) if avg_actual else None,
        "extensions_approved": sum(t.due_date != assignment.due_date for t in tasks),
    }
    if with_students:
        stats["student_rows"] = sorted(({
            "student_id": t.user_id,
            "name": t.user.name,
            "status": t.status,
            "due_date": iso_datetime(t.due_date),
            "estimated_hours": t.estimated_hours,
            "actual_hours": t.actual_hours,
            "completed_at": iso_datetime(t.completed_at),
            "late": t.is_late or (t.status != "done" and local_day(t.due_date) < today),
        } for t in tasks), key=lambda r: (r["status"] == "done", r["name"]))
    return stats


def class_average_hours(assignment_id: int) -> dict:
    """What classmates actually spent on an assignment (shown to students)."""
    rows = db.session.scalars(db.select(Task.actual_hours).where(
        Task.assignment_id == assignment_id, Task.status == "done", Task.actual_hours.is_not(None))).all()
    return {"completed": len(rows), "avg_actual_hours": round(mean(rows), 1) if rows else None}


def class_ratios(assignment_ids: list[int]) -> dict:
    """{assignment_id: (avg actual / expected hours, number done)} - Model B's class signal."""
    if not assignment_ids:
        return {}
    out = defaultdict(list)
    rows = db.session.execute(db.select(Task.assignment_id, Task.actual_hours, Assignment.expected_hours)
                              .join(Assignment, Task.assignment_id == Assignment.id)
                              .where(Task.assignment_id.in_(assignment_ids), Task.status == "done",
                                     Task.actual_hours.is_not(None)))
    for aid, actual, expected in rows:
        out[aid].append(actual / expected)
    return {aid: (mean(v), len(v)) for aid, v in out.items()}


def ml_estimates(open_tasks, done_tasks) -> dict:
    """{task_id: predicted real hours} for a student's open tasks (empty if Model B is not loaded)."""
    from ml.features import user_speed_ratio  # noqa: PLC0415

    from . import ml_service  # noqa: PLC0415

    speed = user_speed_ratio(done_tasks)
    ratios = class_ratios([t.assignment_id for t in open_tasks if t.assignment_id])
    out = {}
    for t in open_tasks:
        ratio, n = ratios.get(t.assignment_id, (None, 0))
        est = ml_service.estimate_hours(t, speed, ratio, n)
        if est is None:
            return {}
        out[t.id] = est
    return out


# ---------------------------------------------------------------- subject share & stress

def subject_share(ctx: dict, today: date, teacher_id: int, days: int = 14) -> list[dict]:
    """Which subjects make up the class's workload over the next `days` days."""
    end = today + timedelta(days=days - 1)
    hours = defaultdict(float)
    meta = {}
    for data in ctx.values():
        for t in data["open"]:
            in_window = sum(h for d, h in spread_task(t, today).items() if d <= end)
            if not in_window:
                continue
            if t.assignment_id:
                c = t.assignment.classroom
                key = c.subject_name
                meta[key] = {"colour": c.colour, "is_mine": c.teacher_id == teacher_id or meta.get(key, {}).get("is_mine", False)}
            else:
                key = "Personal tasks"
                meta[key] = {"colour": "#94A3B8", "is_mine": False}
            hours[key] += in_window
    n = len(ctx) or 1
    total = sum(hours.values()) or 1
    return sorted(({"subject": k, "avg_hours_per_student": round(v / n, 1), "share": round(v / total, 2), **meta[k]}
                   for k, v in hours.items()), key=lambda r: -r["share"])


def stress_trend(student_ids: list[int], weeks: int = 6) -> list[dict]:
    if not student_ids:
        return []
    since = _week_start(local_today()) - timedelta(weeks=weeks - 1)
    by_week = defaultdict(list)
    for c in db.session.scalars(db.select(CheckIn).where(CheckIn.user_id.in_(student_ids), CheckIn.week_start >= since)):
        by_week[c.week_start].append(c.stress)
    return [{"week_start": w.isoformat(), "avg_stress": round(mean(v), 1), "responses": len(v)}
            for w, v in sorted(by_week.items())]


def class_analytics(classroom: Classroom) -> dict:
    ids = classroom.student_ids()
    ctx = load_context(ids)
    today = local_today()
    assignments = classroom.assignments.order_by(Assignment.due_date.desc()).all()
    return {
        "classroom": classroom.to_dict(with_counts=True),
        "heatmap": class_heatmap(ctx, today, 28),
        "subject_share": subject_share(ctx, today, classroom.teacher_id),
        "assignments": [assignment_stats(a) for a in assignments],
        "roster": roster_with_risk(classroom, ctx),
        "stress_trend": stress_trend(ids),
    }


# ---------------------------------------------------------------- teacher insights

def teacher_insights(teacher: User) -> list[dict]:
    """Plain-language suggestions across a teacher's classes."""
    today = local_today()
    out = []
    seen_groups = set()  # classes with the same students (e.g. DBMS and OS for SE-A) share class-level insights
    for classroom in teacher.classrooms_taught:
        ids = classroom.student_ids()
        if not ids:
            continue
        group = frozenset(ids)
        first_for_group = group not in seen_groups
        seen_groups.add(group)
        ctx = load_context(ids)
        assignments = classroom.assignments.all()

        # 1. Assignments that took much longer than expected.
        for a in assignments:
            s = assignment_stats(a)
            if s["hours_ratio"] and s["done"] >= 5 and s["hours_ratio"] >= 1.3:
                so_far = f" (so far, {s['done']} done)" if local_day(a.due_date) >= today else ""
                out.append({"kind": "estimate", "severity": "info", "classroom_id": classroom.id,
                            "message": f"\"{a.title}\" took students {s['hours_ratio']}x your estimate{so_far}: "
                                       f"{s['avg_actual_hours']} h vs {a.expected_hours} h. Plan for about "
                                       f"{round(s['avg_actual_hours'])} h for similar work."})

        # 2. Crunch days, and own deadlines sitting near them.
        heat = class_heatmap(ctx, today, 14)
        worst = max(heat, key=lambda d: d["pct_overloaded"])
        if first_for_group and worst["pct_overloaded"] >= 0.4:
            day = date.fromisoformat(worst["date"])
            mine_nearby = [a for a in assignments if abs((local_day(a.due_date) - day).days) <= 1 and local_day(a.due_date) >= today]
            soon = sum(d["deadlines"] for d in heat if 0 <= (date.fromisoformat(d["date"]) - day).days <= 2)
            msg = (f"{round(worst['pct_overloaded'] * 100)}% of {classroom.name} is overloaded on "
                   f"{day.strftime('%a %d %b')}" + (f", with {soon} deadlines in the 3 days from then." if soon else "."))
            if mine_nearby:
                msg += f" Your \"{mine_nearby[0].title}\" is due around then; use the Deadline Advisor to find a lighter date."
            out.append({"kind": "crunch", "severity": "warning" if worst["pct_overloaded"] < 0.6 else "critical",
                        "classroom_id": classroom.id, "message": msg})

        # 3. Upcoming work that most students haven't started.
        for a in assignments:
            days_left = (local_day(a.due_date) - today).days
            if 0 <= days_left <= 2:
                s = assignment_stats(a)
                if s["students"] and s["not_started"] / s["students"] >= 0.3:
                    out.append({"kind": "not_started", "severity": "warning", "classroom_id": classroom.id,
                                "message": f"{s['not_started']} of {s['students']} students haven't started "
                                           f"\"{a.title}\" (due in {days_left} day{'s' if days_left != 1 else ''}). A reminder in class may help."})

        # 4. Early warning.
        risky = [r for r in roster_with_risk(classroom, ctx) if r["risk"] == "high"] if first_for_group else []
        if risky:
            names = ", ".join(r["name"] for r in risky[:3]) + (f" and {len(risky) - 3} more" if len(risky) > 3 else "")
            out.append({"kind": "at_risk", "severity": "critical" if len(risky) >= 3 else "warning",
                        "classroom_id": classroom.id,
                        "message": f"{len(risky)} student{'s' if len(risky) > 1 else ''} in {classroom.name} at high risk of "
                                   f"missing deadlines: {names}. A quick check-in could help."})

        # 5. Stress.
        trend = stress_trend(ids, 2) if first_for_group else []
        if trend and trend[-1]["avg_stress"] >= 3.5 and trend[-1]["responses"] >= 3:
            out.append({"kind": "stress", "severity": "warning", "classroom_id": classroom.id,
                        "message": f"Average stress in {classroom.name} is {trend[-1]['avg_stress']}/5 this week "
                                   f"({trend[-1]['responses']} responses). Consider easing new work."})

    pending = db.session.scalar(db.select(db.func.count(ExtensionRequest.id)).join(Assignment).where(
        Assignment.teacher_id == teacher.id, ExtensionRequest.status == "pending"))
    if pending:
        out.append({"kind": "extensions", "severity": "info", "classroom_id": None,
                    "message": f"{pending} extension request{'s' if pending > 1 else ''} waiting for your decision."})

    order = {"critical": 0, "warning": 1, "info": 2}
    return sorted(out, key=lambda i: order[i["severity"]])


# ---------------------------------------------------------------- extension evidence

def extension_evidence(student_id: int, task: Task, requested_due: datetime) -> dict:
    """Snapshot of the student's workload, attached to an extension request."""
    today = local_today()
    data = load_context([student_id])[student_id]
    due_day = max(local_day(task.due_date), today)
    rows = daily_load(data["open"], data["avail"], today, due_day, today)
    clashes = find_conflicts(data["open"], today, max(14, (due_day - today).days + 1))
    due_clash = next((c for c in clashes if c["date"] == due_day.isoformat()), None)
    titles = {t.id: t.title for t in data["open"]}
    return {
        "computed_on": today.isoformat(),
        "days_until_due": (local_day(task.due_date) - today).days,
        "hours_required_until_due": round(sum(r["hours_required"] for r in rows), 1),
        "hours_available_until_due": round(sum(r["hours_available"] for r in rows), 1),
        "overloaded_days": [{"date": r["date"], "load_ratio": r["load_ratio"]} for r in rows if r["rule_label"] == "high"],
        "other_deadlines_on_due_day": [titles[i] for i in (due_clash["task_ids"] if due_clash else []) if i != task.id],
        "open_tasks": len(data["open"]),
        "requested_extra_days": (local_day(requested_due) - local_day(task.due_date)).days,
    }
