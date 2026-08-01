# Monlam Rignor — Tibetan Language Learning Platform

Agentic learning system: React + FastAPI + PostgreSQL/pgvector + Monlam Melong LLM.

## Prerequisites

- Python **3.12** + project `.venv`
- PostgreSQL with **pgvector**
- Node.js 20+
- `MONLAM_API_KEY` in `.env` (Monlam Studio X-API-Key)

## Local setup

```bash
# 1) Python 3.12 venv (already created at repo root)
source .venv/bin/activate
pip install -r backend/requirements.txt

# 2) Database (Homebrew example)
createdb monlam_rignor   # if needed
psql -d monlam_rignor -c 'CREATE EXTENSION IF NOT EXISTS vector;'

# 3) Configure
cp .env.example .env
# set MONLAM_API_KEY and a strong JWT_SECRET (≥32 chars)

# 4) Migrations (also run automatically on API boot)
cd backend && alembic upgrade head && cd ..

# 5) Ingest Classical Tibetan Grammar Handbook (page-wise, BGE-M3 embeddings)
export PYTHONPATH=backend
python backend/scripts/ingest_grammar.py

# 6) Run backend
cd backend && uvicorn app.main:app --reload --port 8000

# 7) Run frontend
cd frontend && npm install && npm run dev
```

- App: http://localhost:5173  
- API: http://localhost:8000/docs (local only; disabled when `APP_ENV=production`)  
- OTP codes print only when `OTP_DEV_LOG=true` (never in production)

## Docker Compose

```bash
# Local / demo stack (hot reload mounts, Mailpit)
docker compose up --build

# Production-shaped stack (no bind mounts / no reload) — see docker-compose.prod.yml
docker compose -f docker-compose.prod.yml up --build
```

Includes PostgreSQL+pgvector, Mailpit (SMTP :1025, UI :8025), backend, frontend.

## Defaults

| Item | Choice |
|------|--------|
| Vector DB | PostgreSQL + pgvector |
| Embeddings | `BAAI/bge-m3` (Tibetan-capable), page-wise PDF chunks |
| Auth | Email OTP once → username/password; short JWT + refresh rotation |
| LLM | Monlam Melong via `POST /api/v1/ai/chat` (`services/llm.py`) |
| Schema | Alembic (`backend/alembic`) |
| Python | 3.12 + `.venv` |
