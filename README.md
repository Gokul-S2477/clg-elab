# AI Placement ERP

Module 1: User & Access Management

## Stack
- Frontend: React + Vite + Tailwind CSS
- Backend: FastAPI + SQLAlchemy + Pydantic
- Database: PostgreSQL on Neon
- Auth: JWT

## Backend
1. Copy `backend/.env.example` to `backend/.env`.
2. Set `DATABASE_URL`, `SECRET_KEY`, and `FRONTEND_ORIGIN`.
3. Install dependencies from `backend/requirements.txt`.
4. Run `uvicorn app.main:app --reload` from the `backend/` folder.

## Frontend
1. Install dependencies from `frontend/package.json`.
2. Run `npm run dev` from the `frontend/` folder.

## Module 1 Features
- Role-based access control
- User CRUD
- Role CRUD
- Permission catalog

> **Note:** The current bundle bypasses the login UI to let us focus on other modules. A mock `admin` user is injected on the frontend; real authentication can be restored later when login is ready.

## Module 2: College & Academic Structure
- College onboarding and metadata
- Department and faculty mapping
- Batch + section coordination
- Placement cell configuration
Use the new `/structure` dashboard to create colleges, tie departments and batches, define sections, and maintain placement cell coordinators.

## Module 3: Learning Hub
- Topic library with summaries, categories, and difficulty tagging
- Resource catalog (tutorials, practice, references)
- Admin forms for adding/editing learning material via `/learning`

**Theme note:** The UI now uses a professional light palette; the earlier dark theme is retired in favor of cleaner surfaces.
