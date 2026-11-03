from . import auth, availability, health, subjects, tasks

BLUEPRINTS = [health.bp, auth.bp, subjects.bp, availability.bp, tasks.bp]
