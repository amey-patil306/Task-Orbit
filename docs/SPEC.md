# Task Orbit: Build Guide (React + Flask)

Nov 3, 2026 · Priyanka Phadatare

> Transcribed from `Task Orbit Build Guide (React + Flask).pdf`.
> **The PDF export is missing sections 5, 9, 12, 13 and 14.** Placeholders below mark them.
> Anything marked **(ASSUMED)** was filled in during development and must be confirmed or
> replaced with the original text.

## 1. Project context

Task Orbit is a React + Flask web app that predicts when a student's workload will overload
them and suggests a study plan that fixes it.

**Problem statement (unchanged from the synopsis):** Students face overlapping deadlines and
heavy academic workloads. Task Orbit uses AI/ML to predict overload and improve task planning.

**Who builds it:** a four-member second-year team at Zeal College of Engineering & Research,
Pune (Project Based Learning, AI/ML domain). **Hard constraint:** everything must run on free
tiers, with a few dozen to a couple of hundred users at most.

### How to use this doc with Claude Code

1. Create a repo called `task-orbit` and save this doc as `docs/SPEC.md`.
2. Add a `CLAUDE.md` at the repo root containing: "Read docs/SPEC.md before any task. Follow its
   stack, folder structure, data model and API exactly. Ask before changing a decision."
3. Build one phase at a time from section 13, using its prompt. Commit after each phase and run
   the tests before moving on.
4. If you change a decision (a table, an endpoint, a library), edit this doc first so Claude Code
   always reads the current truth.

### Fixed decisions

| Decision | Choice | Details in |
|---|---|---|
| Frontend | React (Vite) + Tailwind CSS | section 3, 11 |
| Backend | Python Flask REST API | section 3, 8 |
| Database | PostgreSQL on Neon (SQLite for local dev) | section 4 |
| AI/ML | scikit-learn models loaded inside Flask | section 10 |
| Auth | Email + password, JWT bearer tokens | section 5 |
| Hosting | Vercel (frontend), Render (backend), Neon (database) | section 12 |

## 2. Scope and objectives

The MVP is a working loop: add tasks, see the load per day, get an ML risk prediction, get a
study plan, log what really happened. Everything else is optional.

| Tier | Features |
|---|---|
| MVP (must ship) | Register/login, subjects, task CRUD (assignment, practical, exam, project), weekly availability settings, rule-based daily load and conflict detection, workload heatmap, calendar view, in-app alerts, smart study planner, ML overload classifier and time estimator with rule fallback, logging of actual hours, evaluation notebook |
| Stretch (if time allows) | Email reminders, dark mode, CSV import of a timetable, PWA install, simple admin statistics page |
| Future scope (report only) | LMS integration, Google Calendar sync, WhatsApp notifications, native mobile app |

**Measurable objectives** (adjust the numbers after the first real results, but keep them measurable):

- Conflict detection passes 100% of the unit-test cases in section 14.
- The overload classifier reaches macro-F1 of at least 0.80 on held-out users.
- The ML classifier beats the rule-only baseline by at least 5 macro-F1 points; if it does not,
  report that honestly and explain why.
- The time estimator cuts mean absolute error on hours by at least 15% compared with the raw
  student estimate.
- `GET /api/workload` answers in under 500 ms when the backend is warm.
- The full app runs on free tiers with no card required.

## 3. Tech stack

Every tool is free, widely documented, and small enough for a second-year team to understand
fully. Use plain JavaScript (not TypeScript) in the frontend.

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | React 18+ with Vite | Fast dev server, simple build, deploys to Vercel with zero config |
| Routing | React Router | Standard for single-page apps |
| Server state | TanStack Query (React Query) | Caching, loading and error states without hand-written effects |
| HTTP client | axios | Interceptor to attach the JWT to every request |
| Styling | Tailwind CSS | Quick consistent UI, no custom CSS files to manage |
| Charts | Recharts | React-native charts for trends and bars |
| Calendar | FullCalendar (React) | Month/week views with events out of the box |
| Heatmap | Custom CSS grid component | Simple: a grid of coloured cells, no library needed |
| Forms | React Hook Form | Less boilerplate for the task form |
| Backend framework | Flask 3 with Blueprints | Lightweight, same language as the ML code |
| ORM and migrations | Flask-SQLAlchemy, Flask-Migrate (Alembic) | Models in Python, versioned schema changes |
| Auth | Flask-JWT-Extended, werkzeug password hashing | Standard JWT handling, no home-made crypto |
| Validation | Pydantic (or marshmallow) | Reject bad input before it reaches the database |
| CORS | Flask-CORS | Lets the Vercel frontend call the Render backend |
| Server | gunicorn | Production WSGI server on Render |
| ML | scikit-learn, pandas, numpy, joblib | Matches the synopsis; joblib saves trained models |
| Notebooks | Jupyter | Dataset generation, training, evaluation, report figures |
| Testing | pytest (backend), Vitest + React Testing Library (frontend, optional) | Prove the engine is correct |
| Tooling | Git + GitHub, VS Code, Postman or Thunder Client | Version control and API testing |
| Runtime versions | Node 20 LTS or newer, Python 3.11 or newer | Current, supported, available on all hosts |

**Considered and not chosen:** Next.js (server rendering is not needed for a logged-in
dashboard), Django (heavier than the API needs), TypeScript (valuable but slows a first project),
MongoDB (see section 4).

## 4. Database decision

Use PostgreSQL hosted on Neon's free tier, and SQLite on your laptop for development. The data is
relational (users own subjects, subjects own tasks, tasks own study sessions) and the core
queries are "sum the hours due per day between two dates", which SQL does in one `GROUP BY`.

| Option | Fit for Task Orbit | Free hosting | Verdict |
|---|---|---|---|
| PostgreSQL (Neon) | Strong: joins, constraints, date aggregation, easy `pandas.read_sql` for ML training | Free tier with a small storage cap; compute sleeps when idle and wakes on the next query | **Choose this** |
| PostgreSQL (Supabase) | Same SQL fit | Free tier, but projects can pause after a period of inactivity | Backup choice |
| SQLite | Fine for local development | No: Render's free disk is wiped on every redeploy | Dev only |
| MongoDB Atlas (M0) | Works, but you would hand-write joins and date rollups | Free shared cluster, no expiry | Not chosen |

**Why this differs from the synopsis (viva answer):** the synopsis listed MongoDB, but the
entities have fixed relations and the engine aggregates by date, so a relational database gives
integrity (a task cannot point to a missing subject) and simpler queries. The ML code reads the
same tables directly into pandas.

**Do not use** Render's own free PostgreSQL: it expires after a short period and would delete
your data.

### Setup notes for Claude Code

- One environment variable, `DATABASE_URL`, selects the database. Locally: `sqlite:///dev.db`.
  In production: the Neon connection string (use the pooled one, with `sslmode=require`).
- Create the engine with `pool_pre_ping=True` and a small pool size, because the free database
  drops idle connections.
- All schema changes go through Flask-Migrate. Never edit tables by hand.
- Back up weekly with `pg_dump` from your laptop, and keep `scripts/seed.py` so the demo data can
  be recreated in one command.
- Free-tier limits change often. Check Neon's current limits when you sign up and note them in
  the report.

## 5. Auth

> **MISSING FROM PDF.** (ASSUMED until replaced) Email + password registration; passwords hashed
> with werkzeug `generate_password_hash`; minimum password length 8; login returns a
> Flask-JWT-Extended access token (identity = user id as string) valid for 7 days; no refresh
> tokens in the MVP; emails stored lower-cased.

## 6. Repository structure

One monorepo with two apps and a notebooks folder, so Claude Code sees the whole project at once.

```
task-orbit/
├── CLAUDE.md                  # points Claude Code to docs/SPEC.md
├── docs/SPEC.md               # this document
├── backend/
│   ├── app/
│   │   ├── __init__.py        # create_app(): config, db, jwt, cors, blueprints
│   │   ├── config.py          # reads env vars (DATABASE_URL, JWT_SECRET_KEY, CORS_ORIGINS)
│   │   ├── extensions.py      # db, migrate, jwt instances
│   │   ├── models/            # user.py, subject.py, task.py, availability.py,
│   │   │                      # study_session.py, alert.py, snapshot.py
│   │   ├── schemas/           # pydantic request/response models
│   │   ├── routes/            # auth.py, subjects.py, tasks.py, availability.py,
│   │   │                      # workload.py, planner.py, alerts.py, predict.py, health.py
│   │   ├── services/          # business logic called by routes
│   │   │   ├── workload_engine.py  # rule-based load, conflicts (pure functions)
│   │   │   ├── planner.py          # priority score + greedy scheduler
│   │   │   ├── alert_service.py
│   │   │   └── ml_service.py       # loads joblib models, predict(), fallback
│   │   └── utils/             # dates, errors
│   ├── ml/
│   │   ├── generate_dataset.py     # synthetic data generator
│   │   ├── features.py             # SAME feature code used in training and serving
│   │   ├── train.py                # trains and saves models
│   │   └── artifacts/              # overload_clf.joblib, time_reg.joblib, metrics.json
│   ├── migrations/            # Alembic (created by Flask-Migrate)
│   ├── scripts/seed.py        # demo user + realistic tasks
│   ├── tests/                 # test_engine.py, test_planner.py, test_api.py
│   ├── requirements.txt
│   ├── wsgi.py                # gunicorn entry: from app import create_app
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── main.jsx, App.jsx
│   │   ├── api/               # axios instance + one file per resource
│   │   ├── context/AuthContext.jsx
│   │   ├── pages/             # Login, Register, Dashboard, Tasks, Calendar,
│   │   │                      # Workload, Planner, Alerts, Settings
│   │   ├── components/        # Heatmap, TaskForm, TaskTable, LoadBadge, AlertList...
│   │   └── hooks/             # useTasks, useWorkload, usePlan
│   ├── index.html, vite.config.js, tailwind.config.js
│   └── .env.example           # VITE_API_URL
└── notebooks/                 # 01_dataset.ipynb, 02_training.ipynb, 03_evaluation.ipynb
```

**Rule for Claude Code:** `features.py` is the single source of feature logic. Training and the
live API must both import it, otherwise the model sees different numbers in production than it
did in training.

## 7. Data model

Seven tables, all keyed by integer `id`, all user data scoped by `user_id`. Every query must
filter by the logged-in user's id.

| Table | Columns | Notes |
|---|---|---|
| `users` | id, name, email (unique), password_hash, created_at | Never store plain passwords |
| `subjects` | id, user_id, name, colour (hex), created_at | Used for colouring and grouping |
| `tasks` | id, user_id, subject_id (nullable), title, description, type (assignment, practical, exam, project, other), difficulty (1 to 5), priority (1 to 5), estimated_hours (float), actual_hours (float, nullable), start_date (date, nullable), due_date (datetime), status (todo, in_progress, done), completed_at (nullable), created_at | `actual_hours` is the ML target; ask the student when they mark a task done |
| `availability` | id, user_id, weekday (0 to 6), hours (float) | One row per weekday: study hours available. Default 3 hours on weekdays, 5 on weekends |
| `study_sessions` | id, user_id, task_id, planned_date, planned_hours, done (bool) | Output of the planner; replaced every time the plan is regenerated |
| `alerts` | id, user_id, kind (overload, collision, deadline), severity (info, warning, critical), message, for_date, is_read, created_at | Shown in-app; deduplicate by kind + for_date |
| `workload_snapshots` | id, user_id, day, hours_required, hours_available, load_ratio, rule_label, ml_label (nullable), created_at | A daily record, kept for charts and as real training data |

**Relationships:** users 1-to-many subjects, tasks, availability, study_sessions, alerts,
workload_snapshots. subjects 1-to-many tasks. tasks 1-to-many study_sessions. Deleting a user
cascades to everything they own; deleting a subject sets `subject_id` to null on its tasks.

**Constraints to add:** difficulty and priority between 1 and 5, estimated_hours greater than 0,
one availability row per (user_id, weekday), index on `tasks(user_id, due_date)` and on
`alerts(user_id, is_read)`.

## 8. REST API specification

All routes live under `/api`, speak JSON, and (except register, login and health) require the
header `Authorization: Bearer <token>`.

| Method and path | Purpose | Request body | Response |
|---|---|---|---|
| `GET /api/health` | Keep-alive and uptime check | none | `{"status":"ok"}` |
| `POST /api/auth/register` | Create account | name, email, password | `{user, access_token}` |
| `POST /api/auth/login` | Log in | email, password | `{user, access_token}` |
| `GET /api/auth/me` | Current user | none | `{user}` |
| `GET/POST /api/subjects` | List or create subjects | name, colour | subject(s) |
| `PUT/DELETE /api/subjects/<id>` | Edit or remove | name, colour | subject or 204 |
| `GET /api/tasks` | List tasks; filters `status`, `type`, `subject_id`, `from`, `to` | none | `[task]` |
| `POST /api/tasks` | Create a task | title, type, subject_id, difficulty, priority, estimated_hours, due_date, start_date | task + fresh `workload_summary` |
| `PUT /api/tasks/<id>` | Edit a task | any task field | task + fresh `workload_summary` |
| `PATCH /api/tasks/<id>/complete` | Mark done and log reality | actual_hours | task |
| `DELETE /api/tasks/<id>` | Remove | none | 204 |
| `GET/PUT /api/availability` | Weekly study hours | list of {weekday, hours} | list |
| `GET /api/workload?from=&to=` | Daily load for a date range (rule engine, plus ML label if available) | none | `[{date, hours_required, hours_available, load_ratio, rule_label, ml_label}]` |
| `GET /api/workload/conflicts` | Deadline collisions in the next 14 days | none | `[{date, task_ids, reason, severity}]` |
| `POST /api/predict` | ML overload forecast for the next 7 days | none | `{days:[{date, risk, probability}], model_version, source:"ml"\|"rules"}` |
| `POST /api/plan/generate` | Build a study schedule and replace old sessions | optional: horizon_days | `{sessions:[...], unscheduled:[...], suggestions:[...]}` |
| `GET /api/plan` | Current planned sessions | none | `[study_session]` |
| `PATCH /api/plan/<id>` | Tick a session done | done | study_session |
| `GET /api/alerts` | List alerts (`?unread=true`) | none | `[alert]` |
| `PATCH /api/alerts/<id>/read` | Mark read | none | alert |

### Conventions Claude Code must follow

- Errors always use `{"error": {"code": "validation_error", "message": "...", "fields": {...}}}`
  with the right HTTP status (400, 401, 403, 404, 409).
- Dates are ISO 8601 strings (`2026-11-20` or `2026-11-20T17:00:00`). Store and compare in UTC;
  display in Asia/Kolkata on the frontend.
- A user can only read or change their own rows. Return 404 (not 403) for someone else's id.
- After any task create, update, complete or delete, recompute alerts for the affected dates
  (see section 9).

## 9. Rule-based workload engine and alerts

> **MISSING FROM PDF.** Needed before Phase 3 (load per day, `rule_label` thresholds, conflict
> rules, alert generation, planner priority score). Paste the original section here.
> Known from other sections: heatmap colours use load ratio green < 0.7, amber 0.7–1.0,
> red > 1.0, dark red > 1.3.
>
> **(ASSUMED) interim rule implemented in `services/workload_engine.py`:** each open task's
> `estimated_hours` is spread evenly from max(today, start_date) to its due day inclusive;
> overdue open tasks put all their hours on today; done tasks add nothing.
> `load_ratio = hours_required / hours_available` (null when work is due on a 0-hour day);
> `rule_label`: low < 0.7 ≤ medium ≤ 1.0 < high. `workload_summary` = the next 7 days of these
> rows plus `overloaded_days`. Task create/update respond with
> `{"task": {...}, "workload_summary": {...}}`.
>
> **(ASSUMED) other interim rules** — "today" and a deadline's day are taken in IST:
> - **Conflicts:** 2+ open deadlines on the same day in the next 14 days; `critical` if 3+ or
>   one is an exam, else `warning`.
> - **Alerts** (recomputed after task/availability changes and on `GET /api/alerts`):
>   `overload` for each high day (critical above 1.3), `collision` per conflict, `deadline`
>   for overdue/due today (warning, critical if overdue) and due tomorrow (info).
> - **Planner:** `priority_score = 2·priority + difficulty + 10/(days_left+1) + 3 if exam`.
>   Tasks are placed earliest-deadline-first (score breaks ties) on the earliest days with free
>   time, max 3 h of one task per day (lifted if needed); ticked sessions count as done hours.
> - **Predict:** falls back to rule labels (`source: "rules"`, `model_version: "rules-v0"`,
>   `probability: null`) until `ml/artifacts/overload_clf.joblib` exists.

## 10. ML plan

Two small scikit-learn models do the AI/ML work: one predicts how overloaded the next days will
be, the other corrects the student's time estimates. Both are compared against the rule-only
baseline from section 9, and the API falls back to rules whenever a model is missing or unsure.

**Model A: overload classifier.** Input: features describing a student's upcoming tasks. Output:
risk label `low`, `medium` or `high` for each of the next 7 days, with a probability.

**Model B: time estimator.** Input: a task's estimated hours, difficulty, type, and the student's
past ratio of actual to estimated hours. Output: predicted actual hours. The workload engine then
uses the corrected hours instead of the raw estimate.

**Features for Model A** (computed per user per day in `ml/features.py`; the same function runs
in training and in the API):

| Feature | Meaning |
|---|---|
| `n_due_3d`, `n_due_7d` | Tasks due within 3 and 7 days |
| `hours_due_3d`, `hours_due_7d` | Weighted effort due in those windows |
| `avg_difficulty`, `max_difficulty` | Over open tasks due in 7 days |
| `exam_within_7d` | 1 if any exam is due in 7 days |
| `avail_hours_3d`, `avail_hours_7d` | Study hours the student has in those windows |
| `rule_ratio_3d`, `rule_ratio_7d` | Rule-engine load ratios (baseline signal) |
| `backlog_hours` | Unfinished effort already overdue or due today |
| `weekday` | 0 to 6 |
| `user_speed_ratio` | The student's average actual-to-estimated hours so far (1.0 if new) |

### Dataset plan (be honest about this in the report)

1. **Synthetic data first.** `generate_dataset.py` simulates 300 or more students over many
   weeks. Each student gets a hidden speed factor (some work slower than they estimate) and each
   task a random difficulty and size. The **label** is whether the day's real load (using
   simulated actual hours) exceeded available hours. Features only contain what the app can see
   (estimates), so the model has to learn the gap between estimate and reality. This is why ML
   can beat a pure rule.
2. **Real data second.** Share a short form with 20 to 30 classmates: tasks, estimated hours,
   actual hours, and a weekly "How overloaded did you feel, 1 to 5?" rating. Use it to validate
   the model, and report the results separately from synthetic ones.
3. **Keep learning.** Every completed task adds an `actual_hours` row; retrain offline with
   `train.py` when enough rows accumulate.

### Training and evaluation

- Models to compare: Logistic Regression (baseline), Random Forest, Gradient Boosting. Pick the
  best by cross-validated macro-F1.
- Split by **student** (`GroupShuffleSplit`), not by row, so one student's data never appears in
  both train and test.
- Report accuracy, macro-F1, a confusion matrix and feature importances. For Model B report MAE
  and R-squared against the raw-estimate error.
- Save `overload_clf.joblib`, `time_reg.joblib` and `metrics.json` (with a `model_version`) into
  `backend/ml/artifacts/`.

### Serving rules

- Load models once at app start in `ml_service.py`, not per request.
- If a file is missing, the prediction raises, or the top class probability is below 0.5, return
  the rule-based label and set `source` to `rules`.
- Keep model files small (a few MB): the free backend has limited memory. Use at most 100 trees.

## 11. Frontend spec

The frontend is a single-page React app with nine screens; the dashboard is the home screen and
must answer "Am I in trouble this week, and what should I do next?" in one glance.

| Page (route) | What it shows | Data from |
|---|---|---|
| Login, Register (`/login`, `/register`) | Forms with validation and error messages | `/api/auth/*` |
| Dashboard (`/`) | Today's load badge, next 7 days risk strip, 14-day heatmap, top 5 priority tasks, unread alerts | `/api/workload`, `/api/predict`, `/api/tasks`, `/api/alerts` |
| Tasks (`/tasks`) | Table with filters (status, type, subject), add/edit modal, complete dialog asking for actual hours | `/api/tasks`, `/api/subjects` |
| Calendar (`/calendar`) | FullCalendar month and week views; tasks coloured by subject, red border on collision days | `/api/tasks`, `/api/workload/conflicts` |
| Workload (`/workload`) | Heatmap over 4 weeks, bar chart of required vs available hours, rule vs ML label per day | `/api/workload`, `/api/predict` |
| Planner (`/planner`) | Generated study sessions grouped by day, "Regenerate plan" button, tick sessions done, list of unscheduled tasks with suggestions | `/api/plan/*` |
| Alerts (`/alerts`) | Alert list with severity colours, mark as read | `/api/alerts` |
| Settings (`/settings`) | Weekly availability inputs (7 numbers), manage subjects and colours | `/api/availability`, `/api/subjects` |

**Key components:** `Heatmap` (grid of cells, colour by load ratio: green below 0.7, amber 0.7 to
1.0, red above 1.0, dark red above 1.3, with a hover tooltip showing hours), `LoadBadge`,
`TaskForm`, `TaskTable`, `AlertList`, `SessionList`, `ProtectedRoute`, `Navbar`, `EmptyState`,
`Spinner`.

### State and data rules

- Server data lives in TanStack Query (query keys like `['tasks']`, `['workload', from, to]`).
  After any task mutation, invalidate `tasks`, `workload`, `predict`, `plan` and `alerts`.
- Auth state lives in `AuthContext`. Store the token in `localStorage`, attach it with an axios
  request interceptor, and on any 401 clear it and redirect to `/login`.
- The API base URL comes from `import.meta.env.VITE_API_URL`; never hard-code it.
- Every page needs three states: loading, error with a retry button, and empty with a call to
  action.

### UX details that matter

- The first request after the free backend sleeps can take up to a minute. Show a friendly
  "Waking up the server" message when a request runs longer than 4 seconds.
- Responsive layout: usable on a phone. Sidebar becomes a bottom bar on small screens.
- Use the same colour language everywhere for load: green, amber, red.

## 12. Deployment

> **MISSING FROM PDF.** Paste the original section (Vercel / Render / Neon steps).

## 13. Build phases

> **MISSING FROM PDF.** Paste the original phases and prompts. Until then, development follows
> this (ASSUMED) order:
>
> 1. Backend foundation: app factory, config, all seven models + migration, error format,
>    health, auth, subjects, availability, pytest. ✅
> 2. Task CRUD + filters (with interim workload_summary). ✅
> 3. Rule engine (section 9): workload, conflicts, alerts, snapshots. ✅ (interim rules)
> 4. Planner. ✅ (interim rules)
> 5. ML: dataset generator, features, training, `ml_service` fallback, `/api/predict`, notebooks.
> 6. Frontend: all nine screens. ✅
> 7. Seed script, deployment, polish.

## 14. Test cases

> **MISSING FROM PDF.** Paste the conflict-detection unit-test cases here (objective 1 depends on
> them).
