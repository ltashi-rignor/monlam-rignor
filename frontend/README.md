# Frontend — Monlam Rignor

React + Vite SPA for Tibetan learning (dashboard, alphabet, flashcards, practice, tutor, CMS site).

## Develop

```bash
npm install
npm run dev
```

Opens http://localhost:5173. Vite proxies `/api` to the backend (`:8000`) so **httpOnly auth cookies** work on the same origin.

## Build

```bash
npm run build
npm run preview   # optional local preview of the production build
```

Production Docker image uses `Dockerfile.prod` + `nginx.conf` (CSP and security headers; `/api` proxied to the backend service).

## Layout

| Path | Role |
|------|------|
| `src/pages/` | App routes (practice, lessons, grammar, story, CMS, …) |
| `src/components/` | Shared UI (`OfflineBanner`, `WorkingProgress`, `BrandLogo`, …) |
| `src/api/client.js` | Fetch wrapper — `credentials: 'include'`, cookie session, no JWT in `localStorage` |
| `src/store/` | Zustand auth + module progress |
| `src/i18n/` | `bo.js` / `en.js` |
| `src/lib/` | Trace engine, game helpers, lazy `loadTraceData` |
| `src/data/` | Static curriculum / speak timing helpers |

## Auth (browser)

- Login/register responses set `mr_access` / `mr_refresh` httpOnly cookies
- Client keeps a session hint in `sessionStorage` only; legacy `localStorage` tokens are scrubbed
- 401 on protected APIs → cookie refresh → retry, else redirect to login

## Practice UX

- Multiple-choice answers auto-advance to the next item
- Last item shows **Finish** (`practice.finish`); requires an answer on the current card
- Reorder drills may include `tokens[]` shown as chips above the options

## i18n

Prefer adding keys to both `en.js` and `bo.js`. CMS home and practice strings include `eyebrow`, `finish`, `pickThenFinish`, etc.
