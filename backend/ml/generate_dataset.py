"""Synthetic dataset generator (SPEC section 10, "Synthetic data first").

Simulates 300 students in 10 classes of 30 over 12 weeks. Each class has 3 subjects whose
teachers post assignments independently, so deadlines cluster the way they do in real life.

Every student has HIDDEN traits the app cannot see:
  speed          - real hours / estimated hours (some students are much slower than they think)
  procrastinate  - how late they tend to start
  disruptions    - random days where they get less study time than planned (events, illness)

Every assignment also has a hidden "surprise" factor: the teacher's expected hours can be off for a
particular assignment (harder dataset, unclear instructions), and the whole class feels it. That is
the signal classmates' real hours carry for Model B.

Features only use what the app can see (estimates, availability, history), while labels use
the hidden reality. That gap is what the models have to learn, and why ML can beat the rules.

Outputs (backend/ml/data/):
  overload.csv  - Model A: one row per student x forecast day, label low/medium/high
  time.csv      - Model B: one row per finished task, target = actual hours
  risk.csv      - Model C: one row per teacher task observed 1-3 days before its deadline, label late 0/1

Run from backend/:  .venv\\Scripts\\python -m ml.generate_dataset
"""
import math
import random
import sys
from datetime import date, datetime, time, timedelta
from pathlib import Path
from types import SimpleNamespace

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.workload_engine import rule_label, spread_task  # noqa: E402
from app.utils.dates import LOCAL_OFFSET  # noqa: E402
from ml.features import overload_features, risk_features, time_features, user_speed_ratio  # noqa: E402

SEED = 7
N_CLASSES = 10
CLASS_SIZE = 30
DAYS = 84
START = date(2026, 1, 5)  # a Monday; the calendar date itself does not matter
OUT = Path(__file__).resolve().parent / "data"

rng = random.Random(SEED)

TYPE_MIX = [("assignment", 0.45), ("practical", 0.3), ("project", 0.1), ("exam", 0.15)]
HOURS = {"assignment": (2, 5), "practical": (2, 4), "project": (6, 12), "exam": (4, 10), "other": (1, 4)}
WINDOW = {"assignment": (4, 9), "practical": (3, 7), "project": (10, 18), "exam": (7, 14), "other": (2, 6)}


def due_at(day: date) -> datetime:
    """Naive-UTC datetime that falls on `day` in IST (same convention as the app)."""
    return datetime.combine(day, time(12)) - LOCAL_OFFSET


def pick_type():
    r, acc = rng.random(), 0.0
    for t, p in TYPE_MIX:
        acc += p
        if r <= acc:
            return t
    return "assignment"


def sigmoid(x):
    return 1 / (1 + math.exp(-x))


# ---------------------------------------------------------------- world

def make_students():
    students = []
    for c in range(N_CLASSES):
        for i in range(CLASS_SIZE):
            students.append(SimpleNamespace(
                id=c * CLASS_SIZE + i, cls=c,
                speed=min(2.3, max(0.7, rng.lognormvariate(math.log(1.12), 0.22))),
                est_bias=rng.gauss(1.0, 0.1),
                procrastinate=rng.random(),
                availability={d: (rng.choice([2, 3, 3, 4, 4, 5]) if d < 5 else rng.choice([4, 5, 6, 7])) for d in range(7)},
            ))
    for s in students:
        # Hidden day-to-day reality: some days you just get less done than planned.
        s.day_factor = {START + timedelta(days=d): (rng.uniform(0.3, 0.7) if rng.random() < 0.12 else rng.uniform(0.85, 1.1))
                        for d in range(DAYS + 30)}
    return students


def make_assignments():
    """Each class has 3 subjects; each subject's teacher posts work every 5-9 days."""
    assignments = []
    aid = 0
    for c in range(N_CLASSES):
        for subject in range(3):
            day = rng.randint(0, 5)
            while day < DAYS - 5:
                kind = pick_type()
                lo, hi = WINDOW[kind]
                created = START + timedelta(days=day)
                assignments.append(SimpleNamespace(
                    id=aid, cls=c, subject=subject, type=kind,
                    difficulty=rng.choices([1, 2, 3, 4, 5], [1, 3, 4, 3, 1])[0],
                    expected=round(rng.uniform(*HOURS[kind]) * 2) / 2,
                    surprise=rng.lognormvariate(0, 0.25),  # hidden: how far off the teacher's estimate is
                    created=created, due=created + timedelta(days=rng.randint(lo, hi)),
                ))
                aid += 1
                day += rng.randint(5, 9)
    return assignments


def make_tasks(students, assignments):
    """Every student's copy of each class assignment, plus a few personal tasks."""
    tasks = {s.id: [] for s in students}
    by_class = {}
    for a in assignments:
        by_class.setdefault(a.cls, []).append(a)
    for s in students:
        for a in by_class[s.cls]:
            est = max(0.5, round(a.expected * s.est_bias * rng.gauss(1, 0.1) * 2) / 2)
            tasks[s.id].append(_task(s, a.id, a.type, a.difficulty, est, a.created, a.due, a.expected, a.surprise))
        day = 0
        while day < DAYS:
            day += rng.randint(4, 10)
            kind = "other"
            created = START + timedelta(days=day)
            tasks[s.id].append(_task(s, None, kind, rng.randint(1, 3), rng.choice([1, 1.5, 2, 3, 4]),
                                     created, created + timedelta(days=rng.randint(*WINDOW[kind])), None))
    return tasks


def _task(s, aid, kind, difficulty, est, created, due, expected, surprise=1.0):
    actual = est * s.speed * surprise * (1 + 0.08 * (difficulty - 3)) * rng.lognormvariate(0, 0.15)
    return SimpleNamespace(
        assignment_id=aid, type=kind, difficulty=difficulty, estimated_hours=est, expected=expected,
        actual_hours=round(max(0.5, actual) * 2) / 2, created=created, due_day=due, due_date=due_at(due),
        start_date=created, status="todo", is_late=False, finished_day=None,
    )


# ---------------------------------------------------------------- outcomes (who submits late)

def real_ratio(s, tasks, day, today):
    """Hidden truth: real hours needed that day / real hours the student actually had."""
    need = 0.0
    for t in tasks:
        real = SimpleNamespace(**{**t.__dict__, "estimated_hours": t.actual_hours})
        need += spread_task(real, today).get(day, 0.0)
    have = s.availability[day.weekday()] * s.day_factor[day]
    return need / have if have else 3.0


def decide_outcomes(students, tasks):
    """Sample late / on-time for every teacher task, in due order, and log stress per week."""
    stress = {}
    for s in students:
        weekly = {}
        for t in sorted(tasks[s.id], key=lambda t: t.due_day):
            window = [t.due_day - timedelta(days=i) for i in range(3)]
            open_then = [x for x in tasks[s.id] if x.created <= t.due_day - timedelta(days=2) <= x.due_day]
            peak = max(real_ratio(s, open_then, d, t.due_day - timedelta(days=2)) for d in window)
            weekly.setdefault(t.due_day - timedelta(days=t.due_day.weekday()), []).append(peak)
            p = sigmoid(-3.8 + 2.2 * (s.speed - 1) + 1.6 * s.procrastinate + 1.1 * (peak > 1.2)
                        + 0.25 * (t.difficulty - 3) + 0.08 * t.estimated_hours + rng.gauss(0, 0.4))
            t.is_late = rng.random() < p
            t.finished_day = t.due_day + timedelta(days=rng.randint(1, 3)) if t.is_late else t.due_day - timedelta(days=rng.randint(0, 2))
        for week, peaks in weekly.items():
            level = 1.4 + 1.1 * min(2.5, sum(peaks) / len(peaks)) + 0.8 * s.procrastinate + rng.gauss(0, 0.6)
            if rng.random() < 0.75:  # not everyone fills in the check-in
                stress[(s.id, week)] = max(1, min(5, round(level)))
    return stress


def snapshot(tasks, today):
    """What the app would see on `today`: open tasks (created, not finished) and finished ones."""
    open_, done = [], []
    for t in tasks:
        if t.created > today:
            continue
        if t.finished_day is not None and t.finished_day < today:
            done.append(t)
        else:
            open_.append(SimpleNamespace(**{**t.__dict__, "status": "todo"}))
    return open_, done


# ---------------------------------------------------------------- rows

def overload_rows(students, tasks):
    finished = {}  # assignment_id -> [(finished_day, actual / expected)] across the class
    for s in students:
        for t in tasks[s.id]:
            if t.assignment_id is not None:
                finished.setdefault(t.assignment_id, []).append((t.finished_day, t.actual_hours / t.expected))
    rows = []
    for s in students:
        for origin in range(10, DAYS - 7, 2):
            today = START + timedelta(days=origin)
            open_, done = snapshot(tasks[s.id], today)
            speed = user_speed_ratio(done)
            # What the app knows today: classmates who already finished each open assignment.
            class_ratio = {}
            for t in open_:
                seen = [r for d, r in finished.get(t.assignment_id, []) if d < today]
                if seen:
                    class_ratio[t.assignment_id] = sum(seen) / len(seen)
            for f in overload_features(open_, s.availability, today, 7, speed, class_ratio):
                day = date.fromisoformat(f["date"])
                truth = real_ratio(s, open_, day, today)
                rows.append({**f, "student_id": s.id, "label": rule_label(truth), "real_ratio": round(truth, 3)})
    return rows


def time_rows(students, tasks):
    rows = []
    by_assignment = {}
    for s in students:
        for t in tasks[s.id]:
            if t.assignment_id is not None:
                by_assignment.setdefault(t.assignment_id, []).append(t)
    for s in students:
        for t in tasks[s.id]:
            _, done = snapshot(tasks[s.id], t.created)
            if t.assignment_id is not None:
                peers = [p for p in by_assignment[t.assignment_id] if p is not t]
                seen = rng.sample(peers, rng.randint(0, min(20, len(peers))))  # classmates who finished first
                ratio = sum(p.actual_hours / p.expected for p in seen) / len(seen) if seen else None
            else:
                seen, ratio = [], None
            rows.append({**time_features(t, user_speed_ratio(done), ratio, len(seen)),
                         "student_id": s.id, "actual_hours": t.actual_hours})
    return rows


def risk_rows(students, tasks, stress):
    rows = []
    for s in students:
        for t in tasks[s.id]:
            if t.assignment_id is None:
                continue
            today = t.due_day - timedelta(days=rng.randint(1, 3))
            if today < t.created:
                continue
            open_, done = snapshot(tasks[s.id], today)
            target = next((o for o in open_ if o.assignment_id == t.assignment_id), None)
            if target is None:
                continue
            # Procrastinators are less likely to have started a few days before the deadline.
            target.status = "in_progress" if rng.random() > 0.35 + 0.5 * s.procrastinate else "todo"
            week = today - timedelta(days=today.weekday())
            f = risk_features(target, open_, done, s.availability, today, stress.get((s.id, week)))
            rows.append({**f, "student_id": s.id, "late": int(t.is_late)})
    return rows


def main():
    OUT.mkdir(exist_ok=True)
    students = make_students()
    assignments = make_assignments()
    tasks = make_tasks(students, assignments)
    stress = decide_outcomes(students, tasks)

    for name, rows in [("overload", overload_rows(students, tasks)),
                       ("time", time_rows(students, tasks)),
                       ("risk", risk_rows(students, tasks, stress))]:
        df = pd.DataFrame(rows)
        df.to_csv(OUT / f"{name}.csv", index=False)
        print(f"{name}.csv: {len(df):,} rows")


if __name__ == "__main__":
    main()
