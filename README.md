# Campus Signal Intelligence

Foundation for a campus operations intelligence app. Frontend and backend are separate applications. This repository does not include product features yet—only the runnable shell: routing, API client, FastAPI, MongoDB wiring, CORS, health, docs, and error handling.

## Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, React Router, Axios, Recharts, Lucide React
- **Backend:** Python, FastAPI, PyMongo, MongoDB Atlas
- **AI (installed, not routed yet):** Gemini API, Sentence Transformers, scikit-learn, Python priority rules

## Project layout

```text
frontend/                 React + Vite app
backend/app/api/         HTTP routes
backend/app/core/        Settings, logging, errors
backend/app/database/    MongoDB client
backend/app/schemas/     Pydantic response models
backend/app/ai/          Reserved AI package
backend/tests/           API tests
```

## Prerequisites

- Node.js 20.19+ or 22.12+ (Vite 7). This repo includes `frontend/.nvmrc` for Node 26 if you use nvm.
- Python 3.11+ (this machine currently uses the existing project `venv`)
- A MongoDB Atlas connection string (optional for first boot)

## Backend setup

```bash
cd backend
python3 -m venv ../venv
source ../venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Set `MONGODB_URI` in `backend/.env` when you have Atlas credentials. The API starts without it; `/api/v1/health` then reports `mongodb.status: not_configured`.

Start the API from `backend/`:

```bash
cd backend
source ../venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Health: [http://127.0.0.1:8000/api/v1/health](http://127.0.0.1:8000/api/v1/health)
- Swagger UI: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- ReDoc: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
- OpenAPI JSON: [http://127.0.0.1:8000/openapi.json](http://127.0.0.1:8000/openapi.json)

Run tests:

```bash
cd backend
source ../venv/bin/activate
pytest
```

## Frontend setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

The Vite app listens on [http://localhost:5173](http://localhost:5173). `VITE_API_BASE_URL` defaults to `http://127.0.0.1:8000`. FastAPI CORS allows those local origins.

The home page calls `GET /api/v1/health` so you can confirm both processes are up. Start the backend first.

## Environment variables

### Backend (`backend/.env`)

| Variable | Purpose |
| --- | --- |
| `CORS_ORIGINS` | Comma-separated browser origins |
| `MONGODB_URI` | MongoDB Atlas URI |
| `MONGODB_DB_NAME` | Database name (`campus_signal_db`) |
| `GEMINI_API_KEY` | Reserved for later AI work |

### Frontend (`frontend/.env`)

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | FastAPI origin used by Axios |

## Error envelope

Failed API responses use a single shape:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed",
    "details": []
  }
}
```

## What is intentionally not here

Product routes, mock campus data, Gemini endpoints, embeddings pipelines, and dashboards are not stubbed. Add those when the domain model is ready.
