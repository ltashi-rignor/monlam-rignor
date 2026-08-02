# Monlam Rignor (རིག་ནོར།) — Complete Architecture Reference

**Status:** Corrected against the live codebase (August 2026)  
**Product:** Tibetan language learning platform — agentic AI, Melong-first  
**Companion docs:** `README.md`, `frontend/README.md`, `.env.example`, architecture `.docx`

---

## Verdict on the pasted architecture text

The pasted document is **partly correct as vision**, but **outdated / inaccurate as an implementation description**. Use this file as the complete, corrected source of truth.

### What’s wrong or misleading

| Claim in pasted doc | Reality in repo |
|---------------------|-----------------|
| LangGraph is the main orchestrator for all agents | LangGraph exists (`app/graph/workflow.py`) but is used mainly for the **essay pipeline**. Most features call agents **directly from FastAPI routers**. |
| Vector DB = “ChromaDB or pgvector” | **PostgreSQL + pgvector only** (HNSW indexes via Alembic). No ChromaDB in the running stack. |
| LLM options listed as Qwen / Llama / GPT / Claude equally | **Primary = Monlam Melong** via `services/llm.py`. **Claude is optional and only for grammar check** (`GRAMMAR_LLM_PROVIDER`). |
| Six agents only | More agents/tools exist: **Tutor, Story, Interactive Lesson, Grammar Quest, Vocab Rain / games**, plus banks/fallbacks. |
| Project tree shows only auth/grammar/essay/planner APIs | Full API surface includes **modules, practice, progress, tutor, story, games, dashboard, recommendations, cms**. |
| Frontend only Dashboard/Path/Grammar/Essay/Practice/Progress | Also: **Alphabet, Flashcards, Handwriting, LetterParty, Lessons, Tutor, Story, Speak, Onboarding, Login, full CMS site**. |
| Future: voice, quizzes, lesson plans, mistake memory, adaptive curriculum | Many of these are **already shipped** (see §9). |
| Auth not described | **Email OTP → username/password**; session via **httpOnly cookies** (`mr_access` / `mr_refresh`), not `localStorage` JWTs. |
| RAG corpus listed as many book types | **Implemented corpus** is primarily the **Classical Tibetan Grammar Handbook PDF** (+ optional secondary OCR PDF). Dictionaries/exams/stories as separate vector corpora are **aspirational**, not fully ingested. |
| Achievements / Vocabulary tables implied | Core entities center on users, progress, plans/lessons, mistakes, essays, practice history, module progress, CMS — not a separate “achievements” product surface. |

### What remains correct

- Multi-agent design around a **shared learner profile**
- FastAPI + React stack
- RAG-grounded grammar where retrieval is wired
- Mistake-driven **daily practice**
- Progress / recommendation loop framing for judges

---

## Framing (keep this)

| Instead of saying | Frame it as |
|-------------------|-------------|
| “We built an AI tutor.” | An **agentic learning system** where specialized AI agents collaborate around a **shared learner profile**, grounded in Tibetan RAG and adaptive practice. |

---

## 1. High-level system architecture

Five layers (as built):

1. **React + Vite frontend** — learner app + public CMS marketing site  
2. **FastAPI backend** (`/api/*`) — auth, rate limits, routers  
3. **Specialized agents** (`backend/app/agents/`) — Melong (and Claude for grammar when configured)  
4. **Shared services** — `llm.py`, `prompt_manager.py`, email, progress sync, seed  
5. **Storage / RAG** — PostgreSQL relational + **pgvector** handbook embeddings  

**Deployment:** local compose or `docker-compose.prod.yml` (nginx CSP + `/api` proxy; `TRUST_PROXY_HEADERS=true` in prod).

```
Browser (React)
    │  credentials: include (httpOnly cookies)
    ▼
Vite proxy / nginx  ──►  FastAPI
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
           Agents        RAG/pgvector    PostgreSQL
              │             │
              ▼             │
         Melong (+ Claude for grammar)
```

---

## 2. Agentic collaboration model

Agents share:

- `User.learner_profile` (goals, ability, style, time, …)
- `Progress.learning_graph` (skills, strengths, weaknesses, next_focus, practice stats)
- `Mistake` rows and practice/essay history

Most routes: **API → agent function → Melong/RAG/DB → JSON**.  
Essay path may use **LangGraph** (`run_essay_pipeline`) to chain grammar + essay evaluation.

### 2.1 Agent responsibilities (complete)

| Agent / module | Input | Output | Role |
|----------------|-------|--------|------|
| **Planner** (`planner_agent` + `fallback_roadmap`) | Learner profile | Week roadmap + lesson stubs | Initial / regenerable learning path |
| **Interactive lesson** (`interactive_lesson_agent` + bank) | Lesson id / profile | Words, dialogue, quiz | Playable path lessons (offline bank + Melong upgrade) |
| **Grammar** (`grammar_agent` + simple check + RAG) | Student text / upload | Mistakes, honorifics, correction, sources | Handbook-grounded correction |
| **Grammar Quest** (`grammar_game_agent` + RAG rounds + bank) | Topic, mistakes | Game rounds | Practice grammar playfully |
| **Essay** (`essay_agent` + LangGraph pipeline) | Full essay | Multi-dimension scores, suggestions | Writing evaluation |
| **Daily Practice** (`practice_agent`) | Mistakes, progress, focus, profile | **8 sanitized** interactive drills | Mistake-driven practice (bank top-up; bad reorder dropped) |
| **Progress** (`progress_agent`) | Activity snapshot | Updated skill graph | Longitudinal skills |
| **Recommendation** (`recommendation_agent`) | History + graph | Next-best focus / content | Closes the loop |
| **Story** (`story_agent`) | Characters, actions, setting | Story + quiz + speak modes | Kid-friendly reading/speaking |
| **Tutor** (`tutor_agent` + TTS/STT APIs) | Chat / audio | Reply, speech | Text + voice Melong tutor |
| **Games** (Vocab Rain API + FE) | Theme, difficulty | Word packs (`ai` or `fallback`) | Vocab Rain / Letter Party |

---

## 3. RAG layer — Tibetan knowledge base

**As implemented**

- Primary: `classical-tibetan-grammar-handbook_compress.pdf`
- Optional secondary: scanned PDF → Monlam OCR → embed (`GRAMMAR_SECONDARY_PDF_PATH`)
- Embeddings: `BAAI/bge-m3` → `KnowledgeChunk` in **pgvector** (HNSW)
- Ingest: `backend/scripts/ingest_grammar.py`
- Retrieve: `app/rag/retriever.py` (used by grammar check / quest)

**Planned / not fully built as separate indexes**

- Dictionaries, school textbooks, past exams, story corpora as dedicated vector collections

**Honesty in UI**

- `OfflineBanner` when Melong is offline / bank / yaml / fallback content is shown

---

## 4. Storage layer

| Layer | Contents (actual) |
|-------|-------------------|
| **PostgreSQL** | Users, email OTP, refresh tokens, progress, learning plans/lessons, mistakes, essays, practice history, module progress, CMS posts / contact, related activity |
| **pgvector** | Grammar handbook (and optional OCR) chunk embeddings |

Not used in production path: **ChromaDB**.

---

## 5. LLM layer

| Provider | Where used |
|----------|------------|
| **Monlam Melong** | Planner, practice, story, tutor, progress, recommendations, most agents (`get_llm()`) |
| **Anthropic Claude** | Optional **grammar check only** (`get_grammar_llm()` / `GRAMMAR_LLM_PROVIDER`) |
| Melong **TTS / STT** | `/api/tutor/tts`, `/api/tutor/stt` (stricter `rate_limit_voice`) |

Shared client: `backend/app/services/llm.py` (JSON helpers, caps, **usage logging**).  
Prompts: `backend/app/services/prompt_manager.py`.

The old list “Qwen / Llama / GPT / Claude” is **not** how the product is wired today.

---

## 6. End-to-end AI workflow (as built)

```
Register (OTP → username/password) → httpOnly session cookies
  → Onboarding / learner_profile (JSONB on User)
  → Planner builds roadmap from profile (Melong or YAML fallback)
  → Study split:
       • Personalized: interactive path lessons, practice, tutor, story, recommendations
       • Static banks: alphabet, flashcards, handwriting (mastery unlock only)
  → Grammar / Essay correct & score (RAG when available) → Mistake rows
  → Daily Practice: mistakes + profile + focus → Melong → sanitize → bank top-up
  → Progress refresh → Dashboard charts
  → Recommendations → optional path regenerate (re-plan)
```

**Important:** The loop is *not* “profile builds flashcards.” Flashcards/Alphabet are fixed curriculum banks; profile-driven generation is Planner / lessons / Practice / Tutor / Story / Recommendations.

### 6.1 Request path

```
React → /api (cookie + optional Bearer)
  → rate limit (XFF only if TRUST_PROXY_HEADERS)
  → router → agent → Melong/Claude/RAG/DB
  → JSON → UI (WorkingProgress; OfflineBanner on fallbacks)
```

### 6.2 Daily practice quality contract

- Target **8** drills; types: fill_blank, particle_pick, honorific_choice, correct_sentence, match_word, ≤1 reorder_phrase, ≤1 free_write  
- Choice answers must match an option; blanks must not leak answers  
- **Reject** numbered paragraph ordering with options like `1, 2, 3, 4`  
- Valid reorder: `tokens[]` of **one** sentence + 4 full-sentence options  
- UX: MC auto-advance; last item **Finish** (`མཇུག་སྒྲིལ།`)

### 6.3 Personalization vs static banks (user input)

Onboarding writes `users.learner_profile` (goals, variety, abilities, alphabet knowledge, vocab size, interests, motivations, challenges, learning styles, schedule, difficulty, `ai_prefs`, accessibility, placement). Agents receive this via `profile_for_agents` / prompt formatting.

| Feature | Uses profile / user input? | How content is chosen |
|---------|----------------------------|------------------------|
| **Planner / learning path** | **Yes** | Melong builds weeks from full profile; fallback YAML only lightly substitutes name/interests |
| **Interactive path lessons** | **Yes** | Theme bank pick from interests + roadmap text; Melong may enrich |
| **Flashcards** | **No** (mastery only) | Fixed themes in `frontend/src/data/flashJourney.js` + words in `tibetan.js`; unlocking next theme via `module` progress |
| **Alphabet** | **No** (mastery only) | Fixed rows in `alphabetJourney.js`; `mastered_letters` unlock |
| **Handwriting** | **No** | Fixed consonants + stroke data |
| **Letter Party / Vocab Rain** | Theme pick (not auto from profile) | Melong pack or YAML fallback for the chosen theme |
| **Grammar check** | Soft (in prompt) | Student text + rules + RAG; mistakes → DB |
| **Grammar Quest** | Mistakes topic optional | Topic pick + RAG/bank/Melong |
| **Essay** | Soft | User essay → Melong scores + mistakes |
| **Daily Practice** | **Yes** | Last mistakes + progress + optional focus chip + profile → Melong (+ `_BANK`) |
| **Progress refresh** | Soft | Activity + profile → Melong skill graph |
| **Recommendations** | **Yes** | Profile + history + `ContentItem` catalog → Melong |
| **Story** | **Yes** | Form (names/actions/setting) + profile tone/level → Melong |
| **Tutor** | **Yes** | Chat + profile in system prompt (+ RAG if grammar-like) |

**Stored but mostly not enforced in UI yet:** `accessibility.*`, many `ai_prefs` (reminders, gamification, high_contrast, audio_first) — may appear in prompts, not as product behavior.

**Flashcards detail**

- Page: `frontend/src/pages/Flashcards.jsx`
- Themes: greetings → family → nature → animals → food → pronouns → numbers (`flashJourney.js`)
- Selecting `learning_styles: flashcards` in onboarding does **not** change deck contents
- Interests like “food” do **not** auto-build a food deck on this page (path lessons / Letter Party are where theme-ish personalization appears)

---

## 7. Security & auth (missing from pasted doc — required)

- OTP hashed; prior unused OTPs invalidated; plaintext OTP rejected  
- Access + refresh as **httpOnly** cookies `mr_access` / `mr_refresh`  
- Frontend: `credentials: 'include'`; scrub legacy `localStorage` JWTs  
- `TRUST_PROXY_HEADERS` default **false**; prod behind nginx sets **true**  
- Separate voice rate limits; readiness probe does not leak JWT/Melong secrets  
- CMS `/stats`: curriculum facts; learner count bucketed / hidden if &lt; 10  

---

## 8. Project structure (complete)

### 8.1 Backend

```
backend/
└── app/
    ├── api/
    │   ├── auth.py
    │   ├── cms.py
    │   ├── dashboard.py
    │   ├── essay.py
    │   ├── games.py
    │   ├── grammar.py
    │   ├── modules.py
    │   ├── planner.py
    │   ├── practice.py
    │   ├── progress.py
    │   ├── recommendations.py
    │   ├── story.py
    │   └── tutor.py
    ├── agents/
    │   ├── planner_agent.py
    │   ├── fallback_roadmap.py
    │   ├── interactive_lesson_agent.py
    │   ├── lesson_content_bank.py
    │   ├── grammar_agent.py
    │   ├── grammar_game_agent.py
    │   ├── grammar_rag_rounds.py
    │   ├── grammar_game_bank.py
    │   ├── simple_grammar_check.py
    │   ├── essay_agent.py
    │   ├── practice_agent.py
    │   ├── progress_agent.py
    │   ├── recommendation_agent.py
    │   ├── story_agent.py
    │   └── tutor_agent.py
    ├── graph/
    │   └── workflow.py          # LangGraph — essay pipeline (not global bus)
    ├── rag/
    │   ├── retriever.py
    │   ├── embeddings.py
    │   └── vector_store.py
    ├── core/
    │   ├── config.py
    │   ├── security.py
    │   ├── auth_cookies.py
    │   ├── rate_limit.py
    │   ├── otp.py
    │   └── passwords.py
    ├── services/
    │   ├── llm.py
    │   ├── claude_llm.py
    │   ├── prompt_manager.py
    │   ├── email.py
    │   ├── progress_sync.py
    │   └── seed.py
    ├── models/
    ├── database/
    └── main.py
alembic/                         # incl. vector HNSW migrations
scripts/ingest_grammar.py
```

### 8.2 Frontend

```
frontend/src/
├── pages/
│   ├── Dashboard, LearningPath, LessonDetail, Lessons
│   ├── Alphabet, Flashcards, Handwriting, LetterParty
│   ├── Tutor, Grammar, Story, Speak, Practice, Progress
│   ├── Login, Onboarding
│   └── cms/* (Home, About, Features, Programs, AI, Blog, News, FAQ, Contact)
├── components/
│   ├── AppLayout, BrandLogo, OfflineBanner, WorkingProgress
│   ├── GrammarGame, GrammarResult, LetterMiniTrace, VoicePicker, …
├── api/client.js                # cookie session
├── store/                       # authStore, moduleProgressStore
├── i18n/                        # bo.js, en.js
├── hooks/
├── lib/                         # traceCore, loadTraceData, …
└── data/
nginx.conf                       # prod CSP + headers + /api proxy
```

---

## 9. Shipped vs future

### Already shipped (do not list only as “future”)

- Voice tutor (TTS/STT) and story speak modes  
- AI-generated / bank interactive lessons and quizzes  
- Mistake memory → daily practice  
- Adaptive learning path from profile  
- Handbook RAG for grammar / quest  
- Public CMS site  
- Handwriting trace + Vocab Rain  
- Practice sanitization + Finish UX  
- httpOnly cookie auth + proxy-aware rate limits  

### Still future / deferred

- Redis-shared rate limits across multiple API workers  
- Full teacher / classroom dashboard  
- Richer pronunciation scoring beyond STT  
- Broader RAG corpora (exams, dictionaries, multi-textbook) as first-class indexes  

---

## 10. Judge framing (still valid)

1. **Collaboration** — specialized agents around one learner profile, not one mega-prompt.  
2. **Persistent memory** — mistakes, practice, and skill graph compound over time.  
3. **Adaptive, retrieval-grounded learning** — daily drills from recent errors, sanitized for quality, grounded in a real handbook index when RAG hits.

Together: an **agentic learning system** (Melong-first, handbook-grounded, production-hardened) — not an AI tutor bolted onto static content.

---

## 11. Quick env checklist

| Variable | Role |
|----------|------|
| `MONLAM_API_KEY` | Melong + TTS/STT/OCR |
| `JWT_SECRET` | ≥32 chars in production |
| `APP_ENV` | `local` \| `production` |
| `TRUST_PROXY_HEADERS` | `true` only behind trusted nginx |
| `GRAMMAR_LLM_PROVIDER` | `auto` \| `claude` \| `melong` |
| `CORS_ORIGINS` | No `*` in production |
| `OTP_DEV_LOG` | Never `true` in production |

---

## 12. Document map

| File | Purpose |
|------|---------|
| `tashi.md` (this file) | **Complete corrected architecture** + agent deep-dive |
| `README.md` | Setup + ops summary |
| `frontend/README.md` | SPA / auth / practice UX notes |
| `Tibetan_Learning_Platform_Architecture (1).docx` | Formatted architecture doc (updated Aug 2026) |
| `Tibetan_Learning_Platform_Architecture_previous.docx` | Backup of older draft (may include old figures) |

---

## 13. Agent deep-dive — how each agent works

All HTTP routes are under `/api`. Agents live in `backend/app/agents/`.  
Typical path: **UI → FastAPI router → agent → Melong (and/or RAG / bank) → JSON → UI**.

Shared context across agents:

- `User.learner_profile`
- `Progress.learning_graph` + skill scores
- `Mistake` rows, practice/essay history

```
Browser (React)
    │  credentials: include
    ▼
FastAPI /api
    ├─► Agents ──► Melong (+ Claude for grammar when configured)
    ├─► RAG (pgvector handbook)
    ├─► YAML / banks (offline)
    └─► PostgreSQL
```

### 13.1 LangGraph (`backend/app/graph/workflow.py`)

| Piece | What it does | Used by HTTP? |
|-------|----------------|---------------|
| `build_workflow()` full graph (planner → grammar → essay → progress → recommend → practice) | Documented / available chain | **No** — not called by any API |
| `run_essay_pipeline()` | Runs **grammar → essay → progress** sequentially | **Yes** — `POST /api/essay/submit` |

Most features call agent functions **directly** from routers; they do not go through the full LangGraph.

### 13.2 Planner Agent

| | |
|--|--|
| **File** | `planner_agent.py` |
| **Entry** | `run_planner(profile)` |
| **API** | `POST /api/planner/generate` |

**Flow:** Profile → if Melong rate-limited, `build_fallback_roadmap` → else Melong JSON roadmap → optional Tibetanize if English-heavy → validate weeks/lessons → on failure, fallback.  
**Side effects:** Archives old plan (if regenerate); writes `LearningPlan` + `Lesson` rows.  
**UI:** Learning path create / regenerate.

### 13.3 Fallback roadmap (helper)

| | |
|--|--|
| **File** | `fallback_roadmap.py` + `content/roadmap.yaml` |
| **Entry** | `build_fallback_roadmap(profile)` |

**Flow:** Load YAML → personalize title/summary from profile → set `offline: true`, `source: "fallback"`.  
**UI:** Same learning-path screen when Melong is unavailable.

### 13.4 Interactive Lesson Agent

| | |
|--|--|
| **File** | `interactive_lesson_agent.py` |
| **Helper** | `lesson_content_bank.py` (`content/lessons.yaml`) |
| **API** | `GET /api/modules/lessons/{id}`, `POST .../regenerate` |

**Flow:** Open lesson from **bank** for instant UX → cache under progress graph → Melong may enrich in background. Explicit regenerate prefers Melong; falls back to bank; `normalize_interactive_lesson` backfills thin Melong output.  
**UI:** Path lesson (words → dialogue → quiz).

### 13.5 Grammar Agent

| | |
|--|--|
| **File** | `grammar_agent.py` |
| **Helpers** | `simple_grammar_check.py`, `simple_grammar_rules.py` |
| **Entry** | `run_grammar(session, text, profile)` |
| **API** | `POST /api/grammar/check`, `POST /api/grammar/check-file` |

**Flow:**
1. Local rule scan (particles, ཡིན/རེད, ཡོད/འདུག, role-case, …)
2. RAG handbook retrieve (`top_k≈4`) into the prompt
3. Claude if `GRAMMAR_LLM_PROVIDER` allows, else Melong
4. Merge rule + LLM mistakes; build corrected text
5. Normalize / dedupe

**Side effects:** Grammar API persists `Mistake` rows.  
**UI:** Grammar check tab / file upload results.

### 13.6 Grammar Quest Agent

| | |
|--|--|
| **File** | `grammar_game_agent.py` |
| **Helpers** | `grammar_rag_rounds.py`, `grammar_game_bank.py` |
| **Entry** | `run_grammar_game(session, topic, recent_mistakes)` |
| **API** | `POST /api/grammar/game` |

**Flow:** Normalize topic → RAG → Melong game rounds → if rate-limited / too few rounds → RAG-built rounds or static bank.  
**UI:** Grammar → Play (Grammar Quest).

### 13.7 Essay Agent

| | |
|--|--|
| **File** | `essay_agent.py` |
| **Entry** | `run_essay_evaluation(text, grammar_summary, profile)` |
| **API** | Via `run_essay_pipeline` on `POST /api/essay/submit` |

**Flow:** After grammar node → Melong scores grammar / vocabulary / fluency / naturalness / overall + suggestions → progress node updates graph.  
**Side effects:** Saves `Essay`, mistakes from grammar step, progress scores.  
**UI:** Essay submit results.

### 13.8 Daily Practice Agent

| | |
|--|--|
| **File** | `practice_agent.py` |
| **Entry** | `run_practice(...)`, `sanitize_practice_exercises(...)` |
| **API** | `POST /api/practice/generate` (submit scores only — no agent re-call) |

**Flow:** Melong builds drills from mistakes + progress + profile → sanitize (drop bad reorder like `1,2,3,4`, require answer ∈ options, ≤1 reorder, ≤1 free-write) → bank top-up to ~8 → `PracticeHistory`.  
**UI:** Daily practice generate / Finish submit.

### 13.9 Progress Agent

| | |
|--|--|
| **File** | `progress_agent.py` |
| **Entry** | `run_progress_update(activity, previous, profile)` |
| **API** | `POST /api/progress/refresh` (+ essay pipeline) |

**Flow:** Melong refreshes skill scores + `learning_graph` from activity.  
**Note:** `GET /api/progress` syncs from DB activity **without** calling Melong. Practice submit can locally nudge skill bars.  
**UI:** Progress refresh / radar after essay.

### 13.10 Recommendation Agent

| | |
|--|--|
| **File** | `recommendation_agent.py` |
| **Entry** | `run_recommendations(history, catalog)` |
| **API** | `GET /api/recommendations` |

**Flow:** Melong reads profile/progress/mistakes + content catalog → recommendations + rationale (no DB write).  
**UI:** Recommended next content.

### 13.11 Story Agent

| | |
|--|--|
| **File** | `story_agent.py` |
| **Entries** | `run_kid_story(...)`, `define_story_word(word)` |
| **API** | `POST /api/story/generate`, `POST /api/story/define` |

**Flow:** Melong JSON story (scenes, glossary, quiz) with local normalizers; define is a smaller Melong call. History stored in progress graph.  
**UI:** Story page + tap-to-define.

### 13.12 Tutor Agent

| | |
|--|--|
| **File** | `tutor_agent.py` |
| **Entries** | `build_tutor_system(...)`, `run_tutor_chat(...)` |
| **API** | `POST /api/tutor/chat` (TTS/STT are separate Melong endpoints) |

**Flow:** If message looks like grammar → RAG handbook block → build system prompt (profile + handbook) → Melong completion. Voice mode may retry near-duplicate replies.  
**UI:** Tutor text / voice tabs.

### 13.13 UI → agent quick map

| User action | Agent |
|-------------|--------|
| Generate / regenerate learning path | Planner (+ fallback) |
| Open path lesson | Interactive lesson (+ bank) |
| Check grammar / upload file | Grammar (+ rules + RAG) |
| Grammar Quest | Grammar game (+ RAG/bank) |
| Submit essay | Grammar → Essay → Progress |
| Build daily practice | Practice (+ sanitize/bank) |
| Refresh Progress | Progress |
| See recommendations | Recommendation |
| Generate story / define word | Story |
| Chat with Melong | Tutor |
| Speak (TTS/STT) | Melong voice APIs (not tutor agent logic) |

### 13.14 Helpers (not standalone agents)

| Module | Role |
|--------|------|
| `lesson_content_bank.py` | Offline interactive lesson themes |
| `grammar_game_bank.py` | Static Grammar Quest rounds |
| `grammar_rag_rounds.py` | Build quest rounds from handbook hits |
| `simple_grammar_check.py` | Deterministic particle/copula scanners |
| `simple_grammar_rules.py` | Rule prose injected into prompts |

**Bottom line:** Prefer this `tashi.md` over older architecture drafts when describing what Monlam Rignor actually is today — including **how each agent runs**, and that **flashcards/alphabet are static banks** (not Melong-built from profile). See §6.3.
