Read docs/SPEC.md before any task. Follow its stack, folder structure, data model and API exactly. Ask before changing a decision.

**The project has pivoted to a teacher + student app: read docs/PLAN_V2.md too. Where it differs from SPEC.md, PLAN_V2.md wins.**
This is a college PBL project: keep code simple and readable; new features do not need unit tests.

## Dev commands

Backend (from `backend/`, Windows):

- Install: `python -m venv .venv` then `.venv\Scripts\pip install -r requirements.txt`
- Migrate: `.venv\Scripts\flask --app wsgi db upgrade`
- Run: `.venv\Scripts\flask --app wsgi run --debug` (http://127.0.0.1:5000)
- Demo data: `.venv\Scripts\python scripts\seed.py` (login demo@taskorbit.in / demo12345)
- Test: `.venv\Scripts\python -m pytest`

Frontend (from `frontend/`):

- Install: `npm install`, then copy `.env.example` to `.env.local`
- Run: `npm run dev` (http://localhost:5173, talks to the backend at `VITE_API_URL`)
- Build: `npm run build`
