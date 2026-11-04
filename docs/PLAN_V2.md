# Task Orbit v2: Teacher + Student pivot

> Status: **active plan** (Nov 3, 2026). Where this conflicts with `SPEC.md`, this file wins.
> Stack, hosting and coding conventions from `SPEC.md` stay the same.

## 1. Why the pivot, and why it is not a drift

**Problem statement (unchanged, from the synopsis):** *Students face overlapping deadlines and heavy
academic workloads. Task Orbit uses AI/ML to predict overload and improve task planning.*

v1 only helped students *react* to overload. But the main cause of overlapping deadlines is that
**each teacher sets deadlines on their own, without seeing what the other subjects have already
given the same class.** v2 attacks the problem at both ends:

- **Students** see all their work in one place (teacher tasks arrive automatically), get overload
  predictions, a study plan, and a fair way to ask for more time.
- **Teachers** see the class's total workload *before* setting a deadline, get the least harmful
  due date suggested, and get early warning about students who are falling behind.

### Mapping to the synopsis

| Synopsis item | Where it lives in v2 |
|---|---|
| Objective: manage all academic tasks and deadlines in one place | Teacher assignments are pushed into every enrolled student's task list; students add personal tasks too |
| Objective: identify overlapping deadlines and workload conflicts | Student conflict detection (v1) **plus** the teacher's *Smart Deadline Advisor*, which catches clashes before they are created |
| Objective: predict periods of high workload using AI/ML | Model A (overload forecast), shown to students *and* aggregated per class for teachers |
| Objective: prioritise tasks by urgency, difficulty, available time | Smart study planner (v1) |
| Objective: reduce last-minute submissions and stress | Early-warning risk model (Model C), weekly stress check-in, workload-backed extension requests |
| Architecture: "Admin panel: anonymized statistics, average weekly workload, high-load weeks, most workload-heavy subjects" | Teacher analytics dashboard |
| Literature survey: early warning of student performance; risk identification + intervention | Model C (missed-deadline risk) + teacher intervention suggestions |
| Future scope: "improve prediction using previous task-completion patterns" | Model B uses classmates' real hours on the same assignment |

## 2. Roles

| Role | How they sign up | What they see |
|---|---|---|
| Student | Register as student, join classes with a 6-character **class code** from the teacher | Student dashboard (v1 screens + classes, extension requests, stress check-in) |
| Teacher | Register as teacher with the college's **teacher signup code** (env `TEACHER_SIGNUP_CODE`), so students cannot pose as teachers | Teacher dashboard: classes, assignments, deadline advisor, analytics, extension inbox |

Login has a **"Log in as" dropdown** (Student / Teacher). `POST /api/auth/login` takes an optional
`role`; if it does not match the account, it returns 403 `wrong_role` ("This is a teacher account…").

Privacy rule: teachers see a student's tasks from **their own classes** in full. Work from other
subjects is shown as **aggregate hours and deadline titles of other teachers' assignments only**.
Students' personal tasks are never shown to teachers, only counted in total hours.

## 3. Features

### Student (keeps every v1 feature)
1. **Unified task list**: teacher assignments appear automatically (read-only title, type and due date;
   the student can set their own estimate, priority, status and actual hours). Personal tasks as before.
2. **Classes**: join with a code, leave, see each class's assignments.
3. **Overload forecast, heatmap, calendar, alerts, planner**: as in v1, now covering teacher tasks.
4. **Workload-backed extension request** *(unique)*: one click on a teacher task. The app attaches
   evidence automatically: the student's load around the due date, clashing deadlines and overloaded
   days. The teacher decides with facts, not excuses.
5. **Weekly stress check-in**: "How overloaded did you feel this week? 1–5". Shown as a trend. It is
   also **real labelled data** for the ML models (the build guide's "real data second" plan).
6. **Smart time estimate** *(unique)*: on a teacher task, shows "Classmates took 6.5 h on average"
   once others finish it.

### Teacher
1. **Classes**: create a class (subject + division), share the code, see the roster.
2. **Assignments**: create, edit or delete an assignment for a class, with expected hours, difficulty,
   type and due date. It is pushed to every enrolled student (and to students who join later).
3. **Smart Deadline Advisor** *(the headline feature)*: while creating an assignment, the teacher
   sees, for the proposed due date:
   - % of the class that would be overloaded in the working window,
   - other deadlines the same students already have that day (from any subject),
   - a verdict (good / risky / bad) and the **3 best alternative dates** within the next 10 days.
4. **Class analytics dashboard**:
   - class workload heatmap (next 4 weeks, % of students overloaded per day),
   - share of the class's workload by subject (is my subject the heavy one?),
   - per-assignment stats: completion rate, late submissions, **expected vs actual hours**,
   - **at-risk students** with reasons (early warning),
   - average stress check-in trend.
5. **Insights & suggestions** (generated text): e.g. *"Assignment 3 took students 1.8× your estimate;
   expect ~7 h next time"*, *"55% of SE-A is overloaded on 12 Nov (3 deadlines incl. CN exam);
   consider moving 'ER diagram'"*, *"6 students haven't started 'Lab 5', due in 2 days"*.
6. **Extension inbox**: approve or reject requests, with the student's workload evidence. Approval
   moves only that student's due date.

## 4. Data model changes (on top of SPEC section 7)

| Table | Change |
|---|---|
| `users` | + `role` (student, teacher), + `department`, + `year` (e.g. "SE"), + `division` |
| `classrooms` *(new)* | id, teacher_id, name, subject_name, colour, join_code (unique), created_at |
| `enrollments` *(new)* | id, classroom_id, student_id, joined_at; unique (classroom_id, student_id) |
| `assignments` *(new)* | id, classroom_id, teacher_id, title, description, type, difficulty, expected_hours, start_date, due_date, created_at |
| `tasks` | + `assignment_id` (nullable, cascade); unique (user_id, assignment_id). Each student gets their own copy so due dates can differ after an extension |
| `extension_requests` *(new)* | id, task_id, assignment_id, student_id, reason, requested_due, status (pending, approved, rejected), evidence (JSON text), teacher_note, created_at, decided_at |
| `checkins` *(new)* | id, user_id, week_start, stress (1–5), note, created_at; unique (user_id, week_start) |
| `alerts` | kinds + `assignment` (new work posted), `extension` (request decided); no DB uniqueness, engine kinds deduplicated in code |

## 5. API additions

Student:

| Method and path | Purpose |
|---|---|
| `GET /api/classrooms` | My classes |
| `POST /api/classrooms/join` | Join with `{code}` |
| `DELETE /api/classrooms/<id>/leave` | Leave a class (its open tasks are removed) |
| `GET /api/tasks/<id>/insight` | Class average actual hours for a teacher task |
| `POST /api/tasks/<id>/extension` | Ask for more time `{reason, requested_due}` (evidence attached by the server) |
| `GET /api/extensions` | My requests |
| `GET/POST /api/checkins` | Weekly stress check-ins |

Teacher (all under `/api/teacher`, role checked, 403 for students):

| Method and path | Purpose |
|---|---|
| `GET/POST /classrooms` | List or create classes |
| `GET/PUT/DELETE /classrooms/<id>` | Class detail with roster and each student's risk |
| `DELETE /classrooms/<id>/students/<sid>` | Remove a student |
| `GET/POST /classrooms/<id>/assignments` | List or create assignments (create pushes tasks to students) |
| `GET/PUT/DELETE /assignments/<id>` | Detail with per-student status; edit or delete |
| `POST /classrooms/<id>/deadline-check` | Smart Deadline Advisor |
| `GET /classrooms/<id>/analytics` | Class analytics dashboard |
| `GET /insights` | Suggestions across all my classes |
| `GET /extension-requests` | Inbox (`?status=pending`) |
| `PATCH /extension-requests/<id>` | Approve or reject `{status, teacher_note}` |

## 6. ML plan (built last)

| Model | Predicts | Who uses it | Key idea |
|---|---|---|---|
| A. Overload classifier | low / medium / high risk per day, next 7 days | Student forecast; averaged per class for teachers | Learns the gap between estimates and reality (v1 plan) |
| B. Time estimator | Real hours a task will take | Student plan + teacher "expected hours" hint | Uses **classmates' actual hours on the same assignment** and the student's own speed ratio |
| C. Missed-deadline risk | Probability a student submits late or misses a task | Teacher early-warning list | Features: past late rate, current overload, days left, task not started, stress check-in |

All three are trained on synthetic data first (`generate_dataset.py`), validated on real seed or
classmate data, split **by student**, and compared with the rule baseline. Rules stay as the fallback.

## 6b. ML results (synthetic data, held-out students)

| Model | Algorithm chosen | Result | Baseline |
|---|---|---|---|
| A. Overload | Logistic Regression | macro-F1 0.749 | rules 0.698 (+5.1 pts); **0.80 target not met** |
| B. Time estimate | Gradient Boosting | MAE 0.76 h | student estimate 1.22 h (38% lower) |
| C. Late risk | Logistic Regression | macro-F1 0.628 | rule score 0.437 (+19.2 pts) |

Details, figures and limitations: `notebooks/task_orbit_ml.ipynb`, `backend/ml/artifacts/metrics.json`.

## 7. Build order

| Phase | Scope |
|---|---|
| **A. Backend** ✅ | Roles + teacher signup code; classrooms, enrollments, assignments → task fan-out; extension requests with evidence; check-ins; deadline advisor; class analytics; teacher insights; rule-based risk score; fresh migration; demo seed (2 teachers, 3 classes, ~30 students, history) |
| **B. UI** ✅ | Role-aware login and register; student additions (classes, extension button, check-in, class-average hint); teacher app: dashboard, classes, class detail with analytics, assignment form with live Deadline Advisor, extension inbox |
| **C. ML** ✅ | Dataset generator, `features.py`, training of A/B/C, `metrics.json`, evaluation notebook, plug into `ml_service` |
| D. Polish | Deploy (Vercel, Render, Neon), report figures, viva demo script |

## 8. Out of scope (mention as future work)

LMS or Google Classroom import, email/WhatsApp notifications, plagiarism or grading, admin/HOD
role across departments, native mobile app.
