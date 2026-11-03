from . import auth, availability, health, subjects

BLUEPRINTS = [health.bp, auth.bp, subjects.bp, availability.bp]
