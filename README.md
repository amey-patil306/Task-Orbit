# Task Orbit

**AI-assisted academic workload planner for students and teachers.**

Students face overlapping deadlines because each teacher sets due dates without seeing what the
other subjects have already given the same class. Task Orbit attacks the problem from both ends:

- **Students** see all their work in one place (teacher assignments arrive automatically), get an
  overload forecast for the coming days, a generated study plan, and a fair way to ask for more time.
- **Teachers** see the whole class's workload *before* setting a deadline, get the least harmful due
  date suggested, and get early warning about students who are likely to submit late.

It is a college PBL project built with **React + Flask + scikit-learn**.

---

## Contents

1. [Features](#1-features)
2. [Tech stack](#2-tech-stack)
3. [Quick start (run it locally)](#3-quick-start-run-it-locally)
4. [Demo accounts](#4-demo-accounts)
5. [How it works](#5-how-it-works)
6. [Machine learning](#6-machine-learning)
7. [Project structure](#7-project-structure)
8. [Data model](#8-data-model)
9. [REST API reference](#9-rest-api-reference)
10. [Configuration (environment variables)](#10-configuration-environment-variables)
11. [Testing](#11-testing)
12. [Deployment](#12-deployment)
13. [Troubleshooting](#13-troubleshooting)
14. [Further documentation](#14-further-documentation)

---

## 1. Features

### Student

| Feature | What it does |
|---|---|
| Unified task list | Teacher assignments appear automatically. Students can't change the title, type or due date of these, but they set their own estimate, priority, status and notes. Personal tasks can be added too. |
| Classes | Join a class with the teacher's 6-character code, or leave it (unfinished tasks from that class are removed). |
| Dashboard | Today's load, a 7-day risk strip (AI forecast), a 14-day heatmap, the top-priority tasks and unread alerts. |
| Workload page | 4-week heatmap, required vs available hours per day, rule label vs ML label. |
| Calendar | Month and week views, tasks coloured by subject, clash days highlighted. |
| Study planner | Generates a day-by-day study schedule within the student's available hours, and lists what doesn't fit, with suggestions. |
| Alerts | Overload days, deadline clashes, due-soon or overdue tasks, new assignments and extension decisions. |
| Extension request | One click on a teacher task. The server attaches **workload evidence** automatically (hours needed vs free, overloaded days, other deadlines that day). |
| Weekly stress check-in | "How overloaded did you feel this week? 1–5". Shown as a trend and used as a signal by the ML models. |
| Smart time estimate | On a teacher task: "AI estimate for you: 5.5 h" and "Classmates took 4 h on average". |
| Settings | Study hours available on each weekday; personal subjects and colours. |

### Teacher

| Feature | What it does |
|---|---|
| Classes | Create a class (gets a join code), edit it, see the roster with each student's risk, remove students. |
| Assignments | Create, edit or delete. A new assignment is copied into every enrolled student's task list, and students who join later get the class's upcoming assignments. |
| **Smart Deadline Advisor** | While creating an assignment: what % of the class would be overloaded, which other deadlines clash that day, a verdict (good / risky / bad) and up to 3 better dates near the one proposed. |
| Class analytics | Class workload heatmap (4 weeks), each subject's share of the load, expected vs actual hours per assignment, at-risk students with reasons, average stress trend. |
| Insights | Generated suggestions, e.g. *"'ER modelling' took students 1.38× your estimate; plan for about 6 h next time"*. |
| Extension inbox | Approve or reject requests with the evidence shown. Approval moves only that student's due date. |

### Roles and privacy

- A user registers as **student** or **teacher**. Teacher sign-up needs the department's
  **teacher signup code** (env `TEACHER_SIGNUP_CODE`), so students can't register as teachers.
- The login page has a **"Log in as" dropdown** (Student / Teacher). If it doesn't match the
  account, login is refused with a clear message.
- Teachers see students' tasks from their **own classes** only. Work from other subjects is shown
  only as aggregate hours and deadline titles; students' personal tasks are never shown, only
  counted in total hours.

---

## 2. Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, React Router 6, TanStack Query 5, axios, React Hook Form, Tailwind CSS 3, Recharts, FullCalendar 6 (plain JavaScript, no TypeScript) |
| Backend | Python 3.11+, Flask 3 (Blueprints), Flask-SQLAlchemy, Flask-Migrate (Alembic), Flask-JWT-Extended, Flask-CORS, Pydantic 2 (request validation) |
| Database | SQLite for local development; PostgreSQL (Neon) in production. One env var `DATABASE_URL` selects it. |
| ML | scikit-learn, pandas, numpy, joblib; matplotlib + Jupyter for the evaluation notebook |
| Testing | pytest (backend) |
| Production server | gunicorn |

**Why PostgreSQL rather than MongoDB?** The data is relational (classes → assignments → per-student
tasks) and the core queries aggregate hours per day between dates, which SQL does directly. The
ML code reads the same tables into pandas.

---

## 3. Quick start (run it locally)

### Prerequisites

- **Python 3.11 or newer** (developed on 3.12)
- **Node.js 20 LTS or newer** (with npm)
- Git

You need **two terminals**: one for the backend (port 5000) and one for the frontend (port 5173).

### 3.1 Clone

```bash
git clone https://github.com/amey-patil306/Task-Orbit.git
cd Task-Orbit
```

### 3.2 Backend

**Windows (PowerShell or cmd):**

```powershell
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
copy .env.example .env                       # optional: defaults work for local dev
.venv\Scripts\flask --app wsgi db upgrade    # create the database tables
.venv\Scripts\python scripts\seed.py         # load demo data (classes, students, history)
.venv\Scripts\flask --app wsgi run --debug   # http://127.0.0.1:5000
```

**macOS / Linux:**

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env                         # optional: defaults work for local dev
.venv/bin/flask --app wsgi db upgrade
.venv/bin/python scripts/seed.py
.venv/bin/flask --app wsgi run --debug
```

Check it's up: open <http://127.0.0.1:5000/api/health>. You should see `{"status":"ok"}`.

> With the default `DATABASE_URL=sqlite:///dev.db`, Flask-SQLAlchemy puts the file at
> `backend/instance/dev.db`. **`seed.py` wipes and refills the database**, so don't run it on data
> you want to keep.

### 3.3 Frontend

```bash
cd frontend
npm install
cp .env.example .env.local        # Windows: copy .env.example .env.local
npm run dev                       # http://localhost:5173
```

`.env.local` holds `VITE_API_URL=http://localhost:5000`, which is where the frontend sends API calls.

Open <http://localhost:5173> and log in with a demo account (next section).

### 3.4 (Optional) Retrain the ML models

Trained models are already committed in `backend/ml/artifacts/`, so this step is **not** needed to
run the app. To regenerate them:

```bash
cd backend
.venv\Scripts\pip install -r requirements-ml.txt     # macOS/Linux: .venv/bin/pip ...
.venv\Scripts\python -m ml.generate_dataset          # writes ml/data/*.csv (not committed)
.venv\Scripts\python -m ml.train                     # writes ml/artifacts/: models, metrics.json, figures/
```

Rebuild and run the evaluation notebook:

```bash
.venv\Scripts\python -m ml.make_notebook
.venv\Scripts\jupyter nbconvert --to notebook --execute --inplace ..\notebooks\task_orbit_ml.ipynb
```

**Restart the backend after training**, because models are loaded once at start-up.

---

## 4. Demo accounts

After `scripts/seed.py`, every account's password is **`demo12345`**.

| Role | Email | Notes |
|---|---|---|
| Teacher | `teacher@taskorbit.in` | Prof. Sana Metkari: teaches DBMS and Operating Systems |
| Teacher | `cn.teacher@taskorbit.in` | Teaches Computer Networks |
| Student | `demo@taskorbit.in` | The main demo student, enrolled in all three classes |
| Students | `student01@taskorbit.in` … `student29@taskorbit.in` | Classmates with realistic history |

Class join codes: **`DBMS4A`**, **`OSYS4A`**, **`CNET4A`**.
Teacher signup code (default): **`ZCOER-TEACHER`**.

Each seeded student has a hidden "speed" (how much longer than expected they really take). It
drives their actual hours, late submissions and stress, so the analytics show real patterns.

---

## 5. How it works

### 5.1 Architecture

```
┌──────────────────────────┐   HTTPS + JSON    ┌──────────────────────────────┐      ┌──────────────┐
│  React SPA (Vite)        │ ───────────────▶  │  Flask API  (/api/*)         │ ───▶ │  SQLite /    │
│  TanStack Query cache    │  Authorization:   │  routes → services → models  │      │  PostgreSQL  │
│  axios + JWT interceptor │  Bearer <JWT>     │  ml_service (joblib models)  │      └──────────────┘
└──────────────────────────┘                   └──────────────────────────────┘
```

- **Routes** (`backend/app/routes/`) parse and validate the request with a Pydantic schema, check
  ownership and role, and call a service.
- **Services** (`backend/app/services/`) hold all the business logic: the workload engine, planner,
  alerts, class analytics, deadline advisor and ML serving.
- **Models** (`backend/app/models/`) are SQLAlchemy tables. All schema changes go through
  Flask-Migrate.
- The **frontend** keeps server data in TanStack Query. After any change it invalidates the
  related queries (`tasks`, `workload`, `predict`, `plan`, `alerts`), so every screen stays in sync.

### 5.2 Authentication

- Passwords are hashed with werkzeug (`generate_password_hash`); minimum length 8; emails are stored
  lower-cased.
- Login and register return a JWT (`Flask-JWT-Extended`, identity = user id) valid for
  `JWT_EXPIRES_DAYS` (default 7).
- The frontend stores the token in `localStorage` and an axios interceptor attaches it to every
  request. On any `401` it clears the token and redirects to `/login`.
- Role checks: teacher routes use `@require_role("teacher")` (a student gets `403`). Reading someone
  else's row returns `404`, never `403`, so ids can't be probed.

### 5.3 The rule-based workload engine (`services/workload_engine.py`)

This is the baseline the ML models are compared against, and the fallback when a model is unsure.

- Each open task's `estimated_hours` is **spread evenly** from `max(today, start_date)` (default
  window 7 days) to its due day. Overdue open tasks put all their hours on today; done tasks add
  nothing.
- For each day: `load_ratio = hours_required / hours_available` (available hours come from the
  student's weekly availability).
- **Label:** `low` < 0.7 ≤ `medium` ≤ 1.0 < `high`. Heatmap colours: green < 0.7, amber 0.7–1.0,
  red > 1.0, dark red > 1.3.
- **Conflicts:** 2 or more open deadlines on the same day within 14 days. `critical` if there are
  3 or more, or if one is an exam; otherwise `warning`.
- **Alerts** are recomputed after task or availability changes: `overload` for each high day,
  `collision` per conflict, `deadline` for due-tomorrow, due-today and overdue tasks. New-assignment
  and extension-decision alerts are added by the class service.
- "Today" and a deadline's day are always taken in **IST (Asia/Kolkata)**. The API stores UTC.

### 5.4 Study planner (`services/planner.py`)

- `priority_score = 2·priority + difficulty + 10/(days_left + 1) + 3 if exam`
- Tasks are placed **earliest-deadline-first** (score breaks ties) into the earliest days with free
  study time, at most 3 h of one task per day (lifted if there's no other way to fit it).
- Sessions already ticked done count as completed hours. Tasks that still don't fit are returned as
  `unscheduled`, with suggestions.

### 5.5 Teacher assignment fan-out (`services/class_service.py`)

- Creating an assignment creates **one task per enrolled student** (`tasks.assignment_id` set).
  Each student has their own copy, so their due date can differ after an extension.
- Editing an assignment copies the title, type, difficulty and description to everyone. The due date
  and estimate change only for students who still have the old value, so approved extensions and
  students' own estimates are kept.
- A student who joins late gets the class's upcoming assignments. Leaving a class (or being removed)
  deletes their unfinished copies; finished ones stay as history.

### 5.6 Smart Deadline Advisor (`services/analytics.py → deadline_advice`)

For the proposed due date it simulates adding the assignment to **every enrolled student's real
workload** (all their subjects plus personal tasks) over the working window (from the start date,
or the 7 days before the due date):

- `pct_overloaded`: share of students with at least one `high` day in that window.
- `clashes`: other assignments due the same day for the same students, from any teacher.
- **Verdict:** `good` if < 20% are overloaded and there are no clashes; `risky` if < 50% and at most
  1 clash; otherwise `bad`.
- Each date gets a score: `pct_overloaded + 0.15 × clashes (+ 0.1 if Sunday)`. It scores every
  future day from 3 days before to 7 days after the proposed date the same way and suggests up to
  **3 dates that score better** (none if nothing nearby is better).

### 5.7 Extension requests

When a student asks for more time, the server takes a snapshot of their workload and stores it as
evidence with the request: hours needed vs available before the deadline, overloaded days, other
deadlines on the due day, and the number of open tasks. Rules: at most 14 extra days, one pending
request per task, not allowed on done tasks. Approval moves only that student's due date and sends
them an alert.

---

## 6. Machine learning

Three scikit-learn models. All are trained on **synthetic data** (`ml/generate_dataset.py`
simulates students with a hidden speed factor), **split by student** (`GroupShuffleSplit`, plus
5-fold `GroupKFold` cross-validation) so no student appears in both train and test, and compared
with the rule baseline.

| Model | Predicts | Used for | Chosen algorithm | Result (held-out students) | Baseline |
|---|---|---|---|---|---|
| **A. Overload classifier** | low / medium / high risk per day, next 7 days | Student forecast; averaged per class for teachers | Logistic Regression | macro-F1 **0.749** | rules 0.698 (+5.1 pts) |
| **B. Time estimator** | Real hours a task will take | "AI estimate for you", planner, workload | Gradient Boosting | MAE **0.76 h**, R² 0.87 | raw student estimate MAE 1.22 h (**38% lower**) |
| **C. Late-submission risk** | Probability a student submits a teacher task late | Teacher early-warning list | Logistic Regression | macro-F1 **0.628** | rule score 0.437 (+19.2 pts) |

**Key features** (all computed in `ml/features.py`, the *same* code is used in training and in the
live API so the model never sees different numbers in production):

- **A:** tasks and hours due in 3/7 days, available hours, rule load ratios (day, 3d, 7d), backlog,
  average and max difficulty, exam within 7 days, the student's speed ratio, class load ratio, weekday.
- **B:** estimated hours, difficulty, type, the student's past actual/estimated ratio, the class's
  average ratio on the same assignment and how many classmates have finished it.
- **C:** days left, started or not, past late rate, overloaded days and peak ratio in the next 7 days,
  open and overdue tasks, latest stress check-in.

**Serving rules** (`services/ml_service.py`):

- Models are loaded **once at start-up** from `backend/ml/artifacts/*.joblib`.
- If a model file is missing, a prediction raises, or the top-class probability is below **0.5**, the
  API returns the rule-based answer and sets `source: "rules"`. The app works without any models.
- `GET /api/ml/status` shows which models are loaded and their version.

**Honest limitations:** Model A did not reach the original 0.80 macro-F1 target, and all results are
on synthetic data. Real classmate data (including the weekly stress check-ins) is the next step.
Full metrics, confusion matrices, feature importances and figures are in
`backend/ml/artifacts/metrics.json`, `backend/ml/artifacts/figures/` and
`notebooks/task_orbit_ml.ipynb`.

---

## 7. Project structure

```
Task-Orbit/
├── README.md                 ← this file
├── docs/
│   ├── SPEC.md               # original build guide (v1: student-only)
│   └── PLAN_V2.md            # teacher + student pivot (wins where it differs from SPEC.md)
├── notebooks/
│   └── task_orbit_ml.ipynb   # ML evaluation notebook (generated by ml/make_notebook.py)
├── backend/
│   ├── wsgi.py               # entry point: `flask --app wsgi …` and `gunicorn wsgi:app`
│   ├── requirements.txt      # runtime dependencies
│   ├── requirements-ml.txt   # + matplotlib, jupyter (training/notebook only)
│   ├── .env.example
│   ├── pytest.ini
│   ├── app/
│   │   ├── __init__.py       # create_app(): config, db, JWT, CORS, blueprints, error handlers, ML load
│   │   ├── config.py         # reads environment variables
│   │   ├── extensions.py     # db, migrate, jwt instances
│   │   ├── models/           # user, subject, task, availability, study_session, alert, snapshot,
│   │   │                     # classroom (+ enrollment), assignment, extension, checkin
│   │   ├── schemas/          # Pydantic request models (validation)
│   │   ├── routes/           # auth, tasks, subjects, availability, workload, planner, alerts,
│   │   │                     # predict, classrooms (student side), teacher, health
│   │   ├── services/
│   │   │   ├── workload_engine.py      # daily load, labels, conflicts (pure functions)
│   │   │   ├── planner.py              # priority score + greedy scheduler
│   │   │   ├── alert_service.py        # recompute alerts
│   │   │   ├── availability_service.py
│   │   │   ├── class_service.py        # assignment → student task fan-out and sync
│   │   │   ├── analytics.py            # class analytics, deadline advisor, risk, insights, evidence
│   │   │   └── ml_service.py           # loads joblib models, predicts, falls back to rules
│   │   └── utils/            # dates (UTC ↔ IST), error format, request helpers (auth, role)
│   ├── ml/
│   │   ├── generate_dataset.py  # synthetic data → ml/data/ (not committed)
│   │   ├── features.py          # single source of feature logic (training AND serving)
│   │   ├── train.py             # trains A/B/C, writes artifacts
│   │   ├── make_notebook.py     # builds notebooks/task_orbit_ml.ipynb
│   │   └── artifacts/           # overload_clf / time_reg / risk_clf .joblib, metrics.json, figures/
│   ├── migrations/           # Alembic migrations (Flask-Migrate)
│   ├── scripts/seed.py       # resets the DB and loads the demo data
│   └── tests/                # pytest: engine, models, tasks, API
└── frontend/
    ├── index.html, vite.config.js, tailwind.config.js, package.json
    ├── .env.example          # VITE_API_URL
    └── src/
        ├── main.jsx, App.jsx # providers and routes (student and teacher areas)
        ├── api/              # axios client (JWT, 401 handling, slow-request banner) + one file per resource
        ├── context/AuthContext.jsx
        ├── hooks/            # TanStack Query hooks per resource
        ├── lib/              # constants, IST date helpers
        ├── components/       # Heatmap, TaskForm, TaskTable, Modal, dialogs, Layout, …
        │   └── teacher/      # AssignmentForm (with Deadline Advisor), ClassHeatmap, InsightList
        └── pages/            # Login/Register, Dashboard, Tasks, Calendar, Workload, Planner,
            │                 # Classes, Alerts, Settings
            └── teacher/      # TeacherDashboard, TeacherClasses, ClassDetail, AssignmentDetail, ExtensionInbox
```

### Frontend routes

| Route | Who | Page |
|---|---|---|
| `/login`, `/register` | Logged out | Auth (role dropdown on login; role choice + teacher code on register) |
| `/` | Student | Dashboard |
| `/tasks`, `/calendar`, `/workload`, `/planner`, `/classes`, `/alerts`, `/settings` | Student | As named |
| `/teacher` | Teacher | Teacher dashboard |
| `/teacher/classes`, `/teacher/classes/:id` | Teacher | Class list, class detail (overview / assignments / students tabs) |
| `/teacher/assignments/:id` | Teacher | Per-student status of one assignment |
| `/teacher/extensions` | Teacher | Extension inbox |

A logged-in user opening the other role's pages is redirected to their own home.

---

## 8. Data model

All tables use integer `id` keys. All student data is scoped by `user_id`.

| Table | Main columns | Notes |
|---|---|---|
| `users` | name, email (unique), password_hash, **role** (student/teacher), department, year, division | |
| `subjects` | user_id, name, colour | Personal subjects for colouring tasks |
| `tasks` | user_id, subject_id?, **assignment_id?**, title, description, type, difficulty 1–5, priority 1–5, estimated_hours, actual_hours?, start_date?, due_date, status, completed_at | `assignment_id` set = a teacher task (unique per user + assignment). `actual_hours` is the ML target. |
| `availability` | user_id, weekday 0–6, hours | Default 3 h on weekdays, 5 h at weekends |
| `study_sessions` | user_id, task_id, planned_date, planned_hours, done | Replaced each time the plan is regenerated |
| `alerts` | user_id, kind, severity, message, for_date, is_read | Kinds: overload, collision, deadline, assignment, extension |
| `workload_snapshots` | user_id, day, hours_required, hours_available, load_ratio, rule_label, ml_label | Daily record for charts and future training |
| `classrooms` | teacher_id, name, subject_name, colour, join_code (unique) | |
| `enrollments` | classroom_id, student_id | Unique (classroom, student) |
| `assignments` | classroom_id, teacher_id, title, description, type, difficulty, expected_hours, start_date, due_date | |
| `extension_requests` | task_id, assignment_id, student_id, reason, requested_due, status, evidence (JSON), teacher_note, decided_at | |
| `checkins` | user_id, week_start, stress 1–5, note | Unique (user, week) |

Deleting a user, class or assignment cascades to what it owns; deleting a subject sets its tasks'
`subject_id` to null. On SQLite, foreign keys are switched on at connect time so cascades work.

---

## 9. REST API reference

Base URL: `http://localhost:5000/api`. All bodies are JSON. Everything except `health`, `register`
and `login` needs `Authorization: Bearer <token>`.

**Error format (always):**

```json
{"error": {"code": "validation_error", "message": "Invalid input", "fields": {"email": "..."}}}
```

Status codes: `400` validation, `401` not logged in or bad credentials, `403` wrong role,
`404` not found or not yours, `409` conflict (duplicate email, already joined, already pending).

**Dates:** ISO 8601. The server stores and compares in UTC; the frontend shows Asia/Kolkata.

### Auth and health

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/health` | | `{"status":"ok"}` |
| POST | `/auth/register` | name, email, password, role, teacher_code (teachers), year, division | → `{user, access_token}` |
| POST | `/auth/login` | email, password, role (optional) | → `{user, access_token}`; `403 wrong_role` if role doesn't match |
| GET | `/auth/me` | | → `{user}` |

### Student

| Method | Path | Purpose |
|---|---|---|
| GET / POST | `/tasks` | List (filters `status`, `type`, `subject_id`, `from`, `to`) / create. Create returns `{task, workload_summary}` |
| PUT / DELETE | `/tasks/<id>` | Edit (teacher-set fields are locked) / delete (personal tasks only) |
| PATCH | `/tasks/<id>/complete` | `{actual_hours}`: mark done |
| GET | `/tasks/<id>/insight` | Teacher expectation, class average, AI estimate |
| POST | `/tasks/<id>/extension` | `{reason, requested_due}`: evidence attached by server |
| GET | `/extensions` | My extension requests |
| GET / POST | `/subjects`, PUT / DELETE `/subjects/<id>` | Personal subjects |
| GET / PUT | `/availability` | Weekly study hours `[{weekday, hours}]` |
| GET | `/workload?from=&to=` | Daily load rows with rule and ML labels |
| GET | `/workload/conflicts` | Deadline clashes, next 14 days |
| POST | `/predict` | 7-day overload forecast `{days, model_version, source}` |
| POST | `/plan/generate`, GET `/plan`, PATCH `/plan/<id>` | Study planner |
| GET | `/alerts` (`?unread=true`), PATCH `/alerts/<id>/read` | Alerts |
| GET | `/classrooms`, POST `/classrooms/join`, DELETE `/classrooms/<id>/leave` | Classes |
| GET / POST | `/checkins` | Weekly stress check-in |
| GET | `/ml/status` | Which ML models are loaded |

### Teacher (prefix `/teacher`; students get `403`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/teacher/overview` | Everything for the teacher dashboard |
| GET | `/teacher/insights` | Generated suggestions |
| GET / POST | `/teacher/classrooms` | List / create classes |
| GET / PUT / DELETE | `/teacher/classrooms/<id>` | Detail with roster and risk / edit / delete |
| DELETE | `/teacher/classrooms/<id>/students/<sid>` | Remove a student |
| GET / POST | `/teacher/classrooms/<id>/assignments` | List / create (create pushes to students) |
| GET / PUT / DELETE | `/teacher/assignments/<id>` | Detail with per-student status / edit / delete |
| POST | `/teacher/classrooms/<id>/deadline-check` | Smart Deadline Advisor `{expected_hours, due_date, start_date?, exclude_assignment_id?}` |
| GET | `/teacher/classrooms/<id>/analytics` | Class analytics |
| GET | `/teacher/extension-requests` (`?status=pending`) | Inbox |
| PATCH | `/teacher/extension-requests/<id>` | `{status: approved\|rejected, teacher_note?, new_due?}` |

**Example: log in and list tasks with curl**

```bash
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@taskorbit.in","password":"demo12345","role":"student"}' | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s http://localhost:5000/api/tasks -H "Authorization: Bearer $TOKEN"
```

---

## 10. Configuration (environment variables)

### Backend: `backend/.env` (copy from `.env.example`; every value has a local default)

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | `sqlite:///dev.db` | Database. Production: Neon pooled URL with `?sslmode=require`. `postgres://` is rewritten to `postgresql://` automatically. |
| `JWT_SECRET_KEY` | dev-only value | **Must** be set to a long random string in production: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `JWT_EXPIRES_DAYS` | `7` | Login lifetime |
| `TEACHER_SIGNUP_CODE` | `ZCOER-TEACHER` | Code teachers enter when registering. Share it only with faculty. |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated frontend origins allowed to call the API |

### Frontend: `frontend/.env.local` (copy from `.env.example`)

| Variable | Example | Meaning |
|---|---|---|
| `VITE_API_URL` | `http://localhost:5000` | Backend base URL, no trailing slash (the app adds `/api`) |

`.env`, `.env.local`, databases, `node_modules/`, `dist/`, virtual envs and `ml/data/` are
git-ignored. **Never commit real secrets.**

---

## 11. Testing

```bash
cd backend
.venv\Scripts\python -m pytest        # macOS/Linux: .venv/bin/python -m pytest
```

There are 57 tests covering the workload engine, models, task CRUD and the HTTP API (auth, the
"log in as" role check, filters, validation, ownership). Tests use an in-memory database, so they
never touch your `dev.db`.

Frontend check: `cd frontend && npm run build` must finish without errors.

**Manual test path (about 5 minutes):**

1. Log in as `teacher@taskorbit.in` with "Teacher" selected. Open a class, click **New
   assignment**, enter hours and a due date, and watch the Deadline Advisor. Pick a suggested date
   and post it.
2. Open **Extension requests** and approve one.
3. Log out and log in as `demo@taskorbit.in` with "Student" selected. The new assignment is in
   **Tasks**. Ask for more time on it, edit your estimate, then mark it done with actual hours.
4. Check that the Dashboard, Workload, Calendar and Planner reflect the changes.
5. Try logging in with the wrong role selected: you should get a clear error.

---

## 12. Deployment

The intended free-tier setup is **Vercel** (frontend) + **Render** (backend) + **Neon**
(PostgreSQL). Render's own free PostgreSQL is not used because it expires and deletes data.

1. **Database (Neon):** create a project and copy the **pooled** connection string.
2. **Backend (Render, Web Service, root `backend/`):**
   - Build: `pip install -r requirements.txt && flask --app wsgi db upgrade`
   - Start: `gunicorn wsgi:app`
   - Env: `DATABASE_URL`, `JWT_SECRET_KEY` (random), `TEACHER_SIGNUP_CODE`,
     `CORS_ORIGINS=https://<your-app>.vercel.app`
   - Optional demo data: run `python scripts/seed.py` once from the Render shell.
3. **Frontend (Vercel, root `frontend/`):** framework Vite, build `npm run build`, output `dist`,
   env `VITE_API_URL=https://<your-backend>.onrender.com`. `frontend/vercel.json` already rewrites
   all paths to `/index.html`, so deep links like `/teacher/classes/1` work.

A sleeping free backend can take up to a minute to answer the first request. The frontend shows
a "Waking up the server" banner when a request takes longer than 4 seconds, and pinging
`/api/health` keeps it awake.

---

## 13. Troubleshooting

| Problem | Fix |
|---|---|
| Frontend shows "Cannot reach the server" | The backend isn't running, or `VITE_API_URL` is wrong. Restart `npm run dev` after editing `.env.local`. |
| Browser console shows a CORS error | Add the frontend's exact origin (scheme + host + port) to `CORS_ORIGINS` and restart the backend. |
| `no such table` errors | Run `flask --app wsgi db upgrade` (and `scripts/seed.py` for demo data). |
| Demo logins don't work | Run `scripts/seed.py`. Also check the "Log in as" dropdown matches the account's role. |
| "Invalid teacher code" on register | Use the value of `TEACHER_SIGNUP_CODE` (default `ZCOER-TEACHER`). |
| `Port 5173 is already in use` | Another dev server is running. Stop it or use `npm run dev -- --port 5174` (and add that origin to `CORS_ORIGINS`). |
| Forecast says `source: "rules"` | Normal when a model is unsure (probability < 0.5) or missing. Check `GET /api/ml/status`. |
| Retrained models aren't used | Restart the backend; models are loaded once at start-up. |
| Email rejected on register | The validator refuses reserved domains such as `.test` or `.local`; use a real-looking domain. |

---

## 14. Further documentation

- `docs/PLAN_V2.md`: teacher + student design: roles, features, data model and API additions, ML plan
  and results.
- `docs/SPEC.md`: original build guide: stack decisions, database choice, v1 engine and ML plan.
- `notebooks/task_orbit_ml.ipynb`: dataset, training and evaluation, with figures.
- `backend/ml/artifacts/metrics.json`: exact model metrics and feature importances.
