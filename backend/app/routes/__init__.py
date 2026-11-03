from . import alerts, auth, availability, classrooms, health, planner, predict, subjects, tasks, teacher, workload

BLUEPRINTS = [
    health.bp, auth.bp, subjects.bp, availability.bp, tasks.bp,
    workload.bp, predict.bp, planner.bp, alerts.bp,
    classrooms.bp, teacher.bp,
]
