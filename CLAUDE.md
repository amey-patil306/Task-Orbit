Read docs/SPEC.md before any task. Follow its stack, folder structure, data model and API exactly. Ask before changing a decision.

## Dev commands

Backend (from `backend/`, Windows):

- Install: `python -m venv .venv` then `.venv\Scripts\pip install -r requirements.txt`
- Migrate: `.venv\Scripts\flask --app wsgi db upgrade`
- Run: `.venv\Scripts\flask --app wsgi run --debug` (http://127.0.0.1:5000)
- Test: `.venv\Scripts\python -m pytest`
