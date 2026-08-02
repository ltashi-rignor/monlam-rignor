# Monlam Rignor (རིག་ནོར།)
## Product & Engineering Presentation

**August 2026**

---

## 1. Introduction

### Who we are

**Monlam Rignor** is a Tibetan language learning platform that brings literacy practice, adaptive AI tutoring, stories, games, grammar support, and progress tracking into one product experience.

### Vision

Help learners build Tibetan from the ground up — letters and handwriting, vocabulary and lessons, conversation and storytelling — with Melong-powered tools that remember the learner across sessions.

### What learners experience

| Journey stage | Experience |
|---------------|------------|
| Discover | Public marketing site (CMS) |
| Join | Email OTP signup → onboarding profile |
| Learn | Path, lessons, alphabet, flashcards, handwriting |
| Practice | Daily drills, Letter Party, grammar check & quest |
| Speak & chat | Melong Tutor (text + voice), Story + speak |
| Grow | Progress graph, recommendations, dashboard |

### How the AI is organized

Each capability is a focused Melong-backed tool (planner, practice, tutor, story, grammar, and more). Tools share lasting learner memory in PostgreSQL — profile, mistakes, skill graph, and plans — so progress compounds as the learner moves through the app.

---

## 2. Architecture diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Browser                                                     │
│  React SPA  ·  CMS pages + Learner app  ·  Tibetan i18n     │
│  httpOnly session cookies (credentials: include)             │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Edge                                                        │
│  Vite proxy (local)  ·  nginx + CSP (production)             │
└───────────────────────────┬─────────────────────────────────┘
                            │  /api/*
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  FastAPI                                                     │
│  Auth · Rate limits · Feature routers                        │
│  api/{auth,planner,modules,practice,grammar,tutor,story,…}   │
└───────┬─────────────┬──────────────┬──────────────┬─────────┘
        │             │              │              │
        ▼             ▼              ▼              ▼
   ┌─────────┐  ┌──────────┐  ┌────────────┐  ┌─────────┐
   │ Agents  │  │ RAG      │  │ PostgreSQL │  │ Redis   │
   │ Melong  │  │ pgvector │  │ profiles   │  │ cache   │
   │ tools   │  │ BGE-M3   │  │ mistakes   │  │ limits  │
   └────┬────┘  └────┬─────┘  │ progress   │  └─────────┘
        │            │        │ plans      │
        ▼            │        └────────────┘
   Melong Studio     │
   chat · TTS · STT · OCR
   (+ Claude for grammar when configured)
```

**Request path:** User action → router → agent or service → Melong / RAG / bank → write shared DB state → JSON → UI.

**Deployment:** `docker-compose.yml` (local) and `docker-compose.prod.yml` (nginx frontend, Redis, pgvector DB).

---

## 3. Tech stack

| Layer | Technology | Role |
|-------|------------|------|
| Frontend | React 19, Vite, React Router, Zustand | SPA, routing, client state |
| Motion / UX | Framer Motion, Tibetan-first i18n | Interaction polish, `bo` / `en` |
| API | FastAPI, Pydantic, Alembic | REST under `/api`, migrations |
| AI agents | `backend/app/agents/*`, `prompt_manager.py` | Specialized Melong tools |
| LLM | Monlam Melong (primary); Claude (grammar option) | Generation & scoring |
| Voice / OCR | Melong TTS, STT, OCR APIs | Tutor, speak, homework extract |
| RAG | BGE-M3, PostgreSQL pgvector, HNSW | Handbook grounding |
| Cache / limits | Redis + in-process TTL fallback | Grammar/RAG cache, rate limits |
| Data | PostgreSQL, SQLAlchemy async | Learner memory & CMS content |
| Content banks | YAML under `content/` | Offline / fail-open paths |
| Ops | Docker Compose, Mailpit, nginx | Local + production-shaped deploy |
| Lint | oxlint (frontend), pytest (backend) | Quality gates |

---

## 4. Features — what each one does

### 4.1 Public CMS
Marketing site in the same SPA: Home, About, Features, Programs, AI, Blog, News, FAQ, Contact. Seeded content and contact form via `/api/cms`. Entry point into login and the learner app.

### 4.2 Auth & onboarding
Email OTP verification once, then username/password. Session via httpOnly JWT cookies. Onboarding captures goals, ability, interests, schedule, and learning preferences into `learner_profile` for personalization.

### 4.3 Dashboard
Home view of learning path status, recent practice, and skill charts. Aggregated from the database for a fast overview.

### 4.4 Learning path & interactive lessons
Melong builds a week-by-week roadmap from the learner profile (YAML fallback available). Lessons run as staged activities: words → dialogue → quiz, with bank content and optional Melong enrichment.

### 4.5 Alphabet
Guided consonant journey: see → hear → trace → word. Mastery unlocks the next rows. Melong TTS for pronunciation playback.

### 4.6 Flashcards
Theme vocabulary decks with hear-and-match drills. Mastery unlocks the next theme. Stable curriculum data with voice support.

### 4.7 Handwriting
Canvas stroke tracing with tip lessons (KharagEdition pack). Builds motor memory for Tibetan letters without requiring an LLM call.

### 4.8 Letter Party (Vocab Rain)
Falling-word game with meaning or typing modes. Theme packs from Melong or YAML fallback. Fast, playful vocabulary practice.

### 4.9 Daily Practice
Melong generates interactive drills from recent mistakes, progress, and profile. A sanitizer keeps drills scorable (valid types, answers in options, blank cleanup). Optional handoff from grammar: practice the errors just found.

### 4.10 Grammar check & Grammar Quest
Hybrid correction: local rules, optional botok spans, handbook RAG, Melong or Claude. Supports OCR homework extract → edit → check. Grammar Quest is a playable drill mode with RAG/bank fallback. Mistakes persist for later practice.

### 4.11 Tutor
Profile-aware Melong chat plus live voice (STT/TTS). Grammar-like questions can use handbook context. Shared voice stack also supports Alphabet, Flashcards, and Story.

### 4.12 Story & speak
Melong generates kid-friendly stories with scenes, glossary, and quiz. Learners can define words, then practice speaking with STT feedback (character-overlap effort score).

### 4.13 Progress & recommendations
Progress page syncs skill bars from activity; refresh runs Melong to update the learning graph. Recommendations suggest next content based on history and profile.

---

## 5. Security implementation

| Area | Implementation |
|------|----------------|
| Session | httpOnly cookies `mr_access` / `mr_refresh`; refresh rotation; logout revokes refresh |
| Passwords | Hashed storage (passlib); OTP codes hashed; prior unused OTPs invalidated |
| Transport / browser | `credentials: include`; prod nginx CSP and security headers |
| Proxy trust | `TRUST_PROXY_HEADERS` default false; enable only behind trusted nginx |
| Rate limiting | Redis sliding window when available; per-IP and per-user caps; stricter voice tier |
| Secrets | Strong `JWT_SECRET` required in production; readiness probe does not leak keys |
| API surface | Docs disabled in production by default; CORS allowlist (no `*` in prod) |
| CMS | Public marketing + contact only — no admin content-management auth surface |
| LLM safety | Token / message / input length caps on Melong requests |

---

## 6. Code maintainability & standards

### Structure we follow

| Pattern | Practice |
|---------|----------|
| Layered backend | `api/` routers → `agents/` or `services/` → `models` / DB |
| One feature, one agent | Clear entry functions (`run_planner`, `run_practice`, …) |
| Shared prompts | Central `prompt_manager.py` for Melong/Claude contracts |
| Shared LLM client | Single `llm.py` (+ `claude_llm.py` for grammar) |
| Config | Pydantic Settings from `.env` / `.env.example` |
| Schema evolution | Alembic migrations under `backend/alembic/` |
| Frontend routes | Feature pages under `pages/`; shared UI in `components/` |
| API client | One `api/client.js` with cookie session |
| i18n | Paired `bo.js` / `en.js` + scan scripts for key drift |
| Fail-open content | YAML banks in `content/` kept separate from agent logic |
| Tests | Backend pytest for agents, auth, cache, practice sanitizer |

### Coding style focus

- Prefer small, typed Python modules with explicit async boundaries  
- Keep Melong JSON contracts validated / sanitized before UI scoring  
- Tibetan-first UI strings in i18n files — avoid hard-coded English in learner flows  
- Document honest behavior (fallbacks, redirects) in README / architecture notes  
- Frontend lint via `oxlint`; keep feature folders predictable for new contributors  

This layout keeps new features additive: add a router + agent + page without rewriting the platform core.

---

## 7. V2 focus — where to invest next

Priority themes for the next product cycle:

| Priority | Focus | Why |
|----------|-------|-----|
| 1 | **Teacher / classroom dashboard** | Schools need multi-learner visibility and assignments |
| 2 | **Richer recommendations + content library** | Replace thin placeholder catalog with real curated items |
| 3 | **Pronunciation feedback (true scoring)** | Move beyond character-overlap effort toward phonetic / quality signals |
| 4 | **Broader RAG corpora** | Dictionaries, textbooks, exam papers as first-class indexes |
| 5 | **Essay / writing UI** | Backend scoring pipeline exists — ship a learner-facing writing surface |
| 6 | **Deeper accessibility & ai_prefs** | Honor onboarding prefs (audio-first, contrast, reminders) in UI |
| 7 | **Offline honesty expansion** | OfflineBanner / status on more fallback surfaces |
| 8 | **Practice & path analytics** | Stronger longitudinal insights for learners and teachers |

### Keep strengthening (ongoing)

- Fail-open banks and Melong timeouts  
- Grammar grounding quality (OCR corpus, botok packs)  
- Redis-backed performance under multi-worker load  
- i18n completeness and UX polish in Tibetan  

---

## Demo flow (optional)

1. CMS home → signup / onboarding  
2. Learning path → lesson  
3. Alphabet or handwriting  
4. Letter Party  
5. Daily Practice  
6. Grammar check → practice from mistakes  
7. Tutor voice · Story speak  
8. Progress + Dashboard  

---

## Closing

**Monlam Rignor** — རིག་ནོར། — a full Tibetan learning platform with a clear architecture, a modern stack, feature-complete learner journeys, production-minded security, and a maintainable codebase ready for V2 growth.
