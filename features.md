# Monlam Rignor (རིག་ནོར།) — Feature Guide

Complete catalog of shipped product features, aligned with the live codebase (August 2026).

**Product:** Tibetan language learning platform  
**App:** React SPA (public CMS + authenticated learner app)  
**API:** FastAPI under `/api/*`

---

## Feature map (quick index)

| Area | Features |
|------|----------|
| **Public site** | Home, About, Features, Programs, AI, Blog, News, FAQ, Contact |
| **Account** | Login (OTP + password), Onboarding profile, Session / logout, Language, Theme |
| **Home** | Dashboard |
| **Learn** | Learning path, Interactive lessons, Alphabet, Flashcards, Handwriting |
| **Practice** | Daily Practice, Letter Party (Vocab Rain), Grammar check, Grammar Quest, Homework OCR |
| **AI companions** | Tutor (text + voice), Story (+ speak drills), Word define |
| **Grow** | Progress, Recommendations |
| **Platform** | i18n, dark/light theme, Redis cache & rate limits, RAG handbook, fail-open banks |
| **Backend-only** | Essay scoring pipeline (no learner UI yet) |

---

## 1. Public CMS (marketing site)

Public pages share `PublicLayout`. Content is served from the database via `/api/cms` (seeded posts, programs, FAQ, stats). There is **no admin CMS login** — this is a public marketing surface that funnels into the learner app.

| Feature | Route | What it does |
|---------|-------|--------------|
| **Home** | `/` | Landing page with brand, highlights, stats, CTAs to login / features |
| **About** | `/about` | Mission and product story |
| **Features** | `/features` | Marketing overview of learning capabilities |
| **Programs** | `/programs` | Program / course catalog list |
| **Program detail** | `/programs/:slug` | Single program page |
| **AI** | `/ai` | AI tools marketing (tutor, grammar, story, etc.) |
| **Blog** | `/blog`, `/blog/:slug` | Blog list and article |
| **News** | `/news`, `/news/:slug` | Announcements list and detail |
| **FAQ** | `/faq` | Frequently asked questions |
| **Contact** | `/contact` | Contact form → `POST /api/cms/contact` |

**Related API:** `GET /api/cms/stats`, posts, announcements; `POST /api/cms/contact`

---

## 2. Account & session

### 2.1 Login & registration — `/login`

- **Email OTP** once to verify email at signup  
- Then set **username / password**  
- Later logins are username/password only (no OTP each time)  
- Session uses **httpOnly cookies** (`mr_access`, `mr_refresh`) with refresh rotation  
- Tokens may also appear in JSON responses; the SPA uses `credentials: 'include'`

**API:** `/api/auth/request-otp`, `verify-email`, `register`, `login`, `refresh`, `logout`, `GET/PUT /api/auth/me`

### 2.2 Onboarding — `/onboarding`

Multi-step learner profile after first login (required before the main app):

- Goals, Tibetan variety / class, ability self-assessment  
- Interests, motivations, challenges  
- Learning styles, schedule / daily minutes, difficulty  
- AI preferences and placement-related fields  

Saved as `users.learner_profile` (JSONB) and passed into Melong agents for personalization.

### 2.3 Language & theme

- **Tibetan / English** UI toggle (`bo` / `en`) in CMS header and app sidebar  
- **Dark / light theme** toggle (CMS + learner app); preference stored in `localStorage` (`mr_theme`)

### 2.4 Account in the app

- Sidebar shows username / email  
- **Sign out** from Account group  
- **Edit profile** returns to onboarding (`/onboarding`)

---

## 3. Dashboard — `/dashboard`

Learner home after login.

- Personalized welcome from profile name  
- Profile chips (level, variety, goals, interests, daily minutes, …)  
- Path summary + current week  
- Week completion ring  
- Latest practice snapshot  
- Skill radar / trend charts (grammar, writing, reading, speaking, vocabulary)  
- Activity bar chart (practices, stories, mistakes over days)  
- Quick links: continue lesson, today’s practice, story, edit profile  

**API:** `GET /api/dashboard` (SQL aggregates — no Melong call on load)

---

## 4. Learning path & lessons

### 4.1 Learning path — `/learning-path`

- Generate / regenerate a **week-by-week roadmap** from the learner profile  
- Melong builds the plan; **YAML fallback** if Melong is unavailable or returns unusable JSON  
- Shows weeks, lessons, and progress status  

**API:** `GET /api/planner/roadmap`, `POST /api/planner/generate`

### 4.2 Lessons list — `/lessons`

- Lists interactive lessons from the current plan / modules  
- Entry into staged lesson play  

### 4.3 Lesson detail — `/lessons/:id`

Interactive path lesson stages:

1. Intro  
2. Words  
3. Dialogue  
4. Notes  
5. Quiz  

- Instant **content bank** for fast load  
- Optional Melong enrichment / regenerate  
- Offline / bank state can show `OfflineBanner`  
- Lesson status updates (in progress / completed)  

**API:** `GET/POST /api/modules/lessons/{id}`, regenerate; module progress / quiz endpoints under `/api/modules`

---

## 5. Literacy craft (fixed curriculum banks)

These surfaces use curated frontend / pack data. They are **not** generated from the onboarding profile. Mastery unlocks the next row or theme. Melong TTS is used for hearing where available.

### 5.1 Alphabet — `/alphabet`

- Consonant-row journey: **see → hear → trace → word**  
- Mastery unlocks subsequent rows  
- Mini-trace practice + voice playback  

**Data:** `frontend/src/data/alphabetJourney.js`, `tibetan.js`

### 5.2 Flashcards — `/flashcards`

- Theme decks (e.g. greetings → family → nature → animals → food → pronouns → numbers)  
- Ritual: see / hear / flip / master  
- Hear-and-match drills  
- Completing a theme unlocks the next  

**Data:** `frontend/src/data/flashJourney.js`

### 5.3 Handwriting — `/handwriting`

- Canvas **stroke tracing** for Tibetan letters  
- Tip lessons and stroke engine (KharagEdition / trace packs)  
- Works without an LLM call  

**Code:** `pages/Handwriting.jsx`, `lib/traceCore.js`, lazy `loadTraceData`

---

## 6. Games

### 6.1 Letter Party / Vocab Rain — `/letter-party`

Falling-word vocabulary game:

- Learner picks a **theme** and play mode (meaning / typing-style modes)  
- Melong generates a word pack via `POST /api/games/vocab-rain`  
- **YAML / local fallback** if Melong fails  
- Score / streak style gameplay loop  

Note: “Letter Party” and “Vocab Rain” are the **same feature** (one route / one game API).

---

## 7. Daily Practice — `/practice`

Adaptive interactive drills.

**What learners do**

- Generate a practice set (or open from Grammar with auto-generate)  
- Answer multiple-choice / fill / reorder / free-write items  
- MC auto-advances; last item uses Finish (`མཇུག་སྒྲིལ།`)  
- Submit scores; history kept  

**How content is built**

- Melong uses recent **mistakes**, progress, profile, and optional focus chips  
- **Sanitizer** enforces scorable drills (allowed types, answer ∈ options, blank leak cleanup, bad reorder dropped)  
- Curated **bank top-up** for adaptive sets when Melong returns too little  
- **Grammar seed path:** “Practice these mistakes” stashes this check’s errors → `seed_mistakes` on generate so drills target those wrong→fix pairs (generic bank skipped when seeded)

**API:** `POST /api/practice/generate`, `submit`; `GET /api/practice/history`, `latest`

---

## 8. Grammar

### 8.1 Grammar check — `/grammar` (Check tab)

Hybrid Tibetan grammar correction:

1. Normalize text  
2. Result cache (memory + optional Redis, ~30 min)  
3. Deterministic **rule scan** (particles, case, copulas, …)  
4. Optional **botok** tokenizer for case-particle spans (fail-open to regex)  
5. **RAG** handbook excerpts (OCR-preferred sources, pgvector + BGE-M3)  
6. **Melong or Claude** (`GRAMMAR_LLM_PROVIDER`) with timeout → else rules + RAG only  
7. Merge mistakes, corrected text, handbook cites  
8. Persist **Mistake** rows for practice / progress  

**UI:** mistake cards, corrected version, sources, CTA to practice these mistakes  

**API:** `POST /api/grammar/check`, `GET /api/grammar/recent-mistakes`

### 8.2 Homework upload (OCR)

- Upload image / PDF → Monlam **OCR** extract  
- Learner edits extracted text  
- Then runs grammar check  

**API:** `POST /api/grammar/extract-file` (and related check-file helpers)

### 8.3 Grammar Quest — `/grammar` (Play / Quest)

- Playable grammar rounds on a topic  
- Melong game generation with **RAG-built rounds** or **static bank** when Melong is rate-limited  
- Can use recent mistakes as optional focus  

**API:** `POST /api/grammar/game`

---

## 9. Tutor — `/tutor`

Melong AI tutor with two modes:

### Text chat

- Profile-aware system prompt  
- Conversation with Melong  
- Grammar-like questions can pull **handbook RAG** into context  

### Voice

- Live **STT** (speech-to-text) and **TTS** (text-to-speech) via Melong  
- Voice rate limits are stricter than general LLM routes  

**API:** `POST /api/tutor/chat`, `/api/tutor/tts`, `/api/tutor/stt`

**Shared voice:** Alphabet, Flashcards, and Story also use Melong TTS / speak helpers.

---

## 10. Story & speak

### 10.1 Story — `/story`

- Melong generates kid-friendly stories (scenes, glossary, quiz)  
- Profile can influence tone / level  
- Tap-to-**define** words (`POST /api/story/define`)  
- Story history stored with progress graph  

**API:** `POST /api/story/generate`, `define`; `GET /api/story/history`

### 10.2 Speak drills (on Story)

- Practice reading / speaking story lines with **STT**  
- Score is Tibetan **character-overlap effort** against the transcript (not full phonetic pronunciation AI)  

### 10.3 `/speak` route

- Compatibility redirect → `/story`  
- Speak lives on the Story page, not as a separate product  

---

## 11. Progress & recommendations — `/progress`

### Progress

- Skill bars and learning graph  
- **GET `/api/progress`:** sync from DB activity (no Melong)  
- **POST `/api/progress/refresh`:** Melong updates longitudinal skill graph, strengths, weaknesses, next focus  

### Recommendations

- Melong suggests next lessons / stories / focus with rationale  
- Reads profile, history, and a content catalog  
- **Read-only** — does not write plans or auto-regenerate the learning path  
- Catalog today is largely **seed / placeholder** content  

**API:** `GET /api/recommendations`

---

## 12. Cross-cutting platform features

| Feature | What it does |
|---------|--------------|
| **Shared learner memory** | Profile, mistakes, progress / learning graph, plans shared across tools |
| **Tibetan-first i18n** | `bo.js` / `en.js`; UI and many agent outputs prefer Tibetan |
| **Dark / light theme** | `data-theme` on `<html>`; app + CMS toggles |
| **Fail-open content** | YAML banks / static packs when Melong fails (path, lessons, practice bank, Letter Party, Grammar Quest) |
| **RAG knowledge base** | Classical Tibetan grammar handbook (+ OCR-preferred sources) in pgvector |
| **Redis (optional)** | Shared grammar/RAG caches + sliding-window rate limits; memory fallback if unset |
| **Rate limiting** | Per IP / user; stricter voice tier; proxy headers only when trusted |
| **Health probes** | `/api/health/live`, `/api/health/ready` (DB, Melong config, Redis status) |
| **Working progress UI** | Loading stages for long Melong calls |
| **OfflineBanner** | Shown on path lessons and Grammar Quest when serving bank/offline content |

---

## 13. Backend-only / limited UI features

| Feature | Status |
|---------|--------|
| **Essay evaluation** | Backend LangGraph pipeline (`grammar → essay → progress`) via `POST /api/essay/submit`. **No learner SPA page** — `/essay` redirects to Story. |
| **Full LangGraph workflow** | `build_workflow()` exists as documentation/demo; no API route runs the full multi-agent graph. |
| **Achievements table** | Schema may exist; not a shipped learner feature. |

---

## 14. Navigation groups (learner app)

As shown in the app sidebar:

| Group | Links |
|-------|-------|
| **Home** | Dashboard, Today’s practice, Learning path, Tutor |
| **Learn** | Alphabet, Lessons, Grammar, Story |
| **Practice** | Handwriting, Letter Party, Flashcards, Practice |
| **Progress** | Learning progress |
| **Website** | CMS pages (Home, About, Programs, Features, Blog, News, FAQ, Contact) |
| **Account** | Profile (onboarding), Sign out |

---

## 15. Personalization summary

| Feature | Uses learner profile? | Notes |
|---------|----------------------|--------|
| Learning path / interactive lessons | Yes | Melong + banks |
| Daily Practice / Tutor / Story / Recommendations | Yes | Prompts + history |
| Grammar | Soft | Profile in prompt; text + rules + RAG drive results |
| Alphabet / Flashcards / Handwriting | No | Fixed banks; mastery unlock |
| Letter Party | Theme pick | Not auto-chosen from profile |
| Dashboard charts | Indirect | Reads stored progress / activity |

---

## 16. Typical learner journey

1. Browse CMS → **Login** (OTP once) → **Onboarding**  
2. Open **Dashboard** → generate **Learning path** → complete a **Lesson**  
3. Practice literacy: **Alphabet** / **Flashcards** / **Handwriting**  
4. Play **Letter Party**; run **Daily Practice**  
5. **Grammar check** (or OCR homework) → **Practice these mistakes**  
6. Chat or speak with **Tutor**; generate a **Story** and use speak drills  
7. Review **Progress** and recommendations  

---

*Source of truth for routes: `frontend/src/App.jsx`. Companion docs: `README.md`, `tashi.md`, `presentation.md`.*
