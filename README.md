# Monlam Rignor — Tibetan Language Learning Platform

Agentic learning system per the architecture document: React + FastAPI + LangGraph + PostgreSQL/pgvector + Claude.

## Prerequisites

- Python **3.12** + project `.venv`
- PostgreSQL with **pgvector**
- Node.js 20+
- `ANTHROPIC_API_KEY` in `.env`

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
# set MONLAM_API_KEY (Monlam Studio X-API-Key)

# 4) Ingest Classical Tibetan Grammar Handbook (page-wise, BGE-M3 embeddings)
export PYTHONPATH=backend
python backend/scripts/ingest_grammar.py

# 5) Run backend
cd backend && uvicorn app.main:app --reload --port 8000

# 6) Run frontend
cd frontend && npm install && npm run dev
```

- App: http://localhost:5173  
- API: http://localhost:8000/docs  
- OTP codes print in the backend console when `OTP_DEV_LOG=true`

## Docker Compose

```bash
docker compose up --build
```

Includes PostgreSQL+pgvector, Mailpit (SMTP :1025, UI :8025), backend, frontend.

## Defaults chosen from clarifications

| Item | Choice |
|------|--------|
| Vector DB | PostgreSQL + pgvector |
| Embeddings | `BAAI/bge-m3` (Tibetan-capable), page-wise PDF chunks |
| Auth | Email OTP + PyJWT on protected routes |
| LLM | Monlam Melong via `POST /api/v1/ai/chat` (`services/llm.py`) |
| Python | 3.12 + `.venv` |
