Read docs/SPEC.md before any task. Follow its stack, folder structure, data model and API exactly. Ask before changing a decision.

## Dev commands

Backend (from `backend/`, Windows):

- Install: `python -m venv .venv` then `.venv\Scripts\pip install -r requirements.txt`
- Migrate: `.venv\Scripts\flask --app wsgi db upgrade`
- Run: `.venv\Scripts\flask --app wsgi run --debug` (http://127.0.0.1:5000)
- Test: `.venv\Scripts\python -m pytest`

Frontend (from `frontend/`):

- Install: `npm install`, then copy `.env.example` to `.env.local`
- Run: `npm run dev` (http://localhost:5173, talks to the backend at `VITE_API_URL`)
- Build: `npm run build`
