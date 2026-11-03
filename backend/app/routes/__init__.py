from . import alerts, auth, availability, health, planner, predict, subjects, tasks, workload

BLUEPRINTS = [
    health.bp, auth.bp, subjects.bp, availability.bp, tasks.bp,
    workload.bp, predict.bp, planner.bp, alerts.bp,
]
