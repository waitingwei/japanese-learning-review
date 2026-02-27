# Japanese Learning Review — JFBP 2

A web app to review grammar, vocabulary, and sentences from **Japanese for Busy People 2**. Data stays in your browser (no login). Uses [JapanDict](https://www.japandict.com/) (link) and [Jisho.org](https://jisho.org/) API for vocabulary lookup.

## Requirements

- **Node.js 18 or newer** (Vite 5 needs it). Check your version:
  ```bash
  node -v
  ```
  If you see v14 or v16, upgrade Node first (see below).

## Run locally

```bash
npm install
npm run dev
```

Then open **http://localhost:5173** in your browser.

If the page is blank or "nothing happens", check:
1. **Terminal** — Did `npm run dev` print "Local: http://localhost:5173" and stay running? If it exited with an error (e.g. `Unexpected token '??='`), your Node version is too old. Upgrade to Node 18+.
2. **Browser** — Open Developer Tools (F12 or Right‑click → Inspect → **Console**). Any red errors there will explain a runtime problem.

## Upgrading Node.js

- **Option A (recommended):** Install [nvm](https://github.com/nvm-sh/nvm) (Node Version Manager), then run:
  ```bash
  nvm install 18
  nvm use 18
  ```
- **Option B:** Download and install Node 18 LTS from [nodejs.org](https://nodejs.org/).

## Features

- **Dashboard**: “Due today” list and links to Review now / Browse all
- **Browse all**: List view with filters by type (Grammar / Vocab / Sentences) and Lesson
- **Flashcards**: Spaced repetition (Again / Good / Easy), deck by “Due today” or “All”
- **Add**: Single grammar, vocab, or sentence; for vocab: “Look up” (Jisho) and “Open in JapanDict”
- **Feed / Import**: Paste or upload CSV, JSON, .txt, or PDF; choose type and lesson; optional “Look up all” for vocab; preview and import

## Notes on “Look up”

- The Jisho API does **not** enable browser CORS, so this app calls it through a **dev-server proxy** at `GET /api/jisho?...` (configured in `vite.config.ts`).
- The “Open in JapanDict” link opens JapanDict’s **search results** page for the word (JapanDict uses the `s=` query param).

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173 (see **Requirements** and **Upgrading Node** above if the app doesn’t load).

## Build

```bash
npm run build
npm run preview
```

## Tech

- React 18, TypeScript, Vite, React Router, Tailwind CSS
- **Local:** localStorage for data; Jisho API for meaning/reading (via Vite proxy); JapanDict links for full entry and verb conjugations
- **Production:** Cloudflare Pages (static + Functions), Neon Postgres, Clerk auth; API replaces localStorage when `VITE_USE_API=true`

## Production deployment (Cloudflare Pages, Neon, Clerk)

To run the app in production with per-user data and auth:

1. **Neon** — Create a project at [neon.tech](https://neon.tech), then run the schema in [migrations/001_initial.sql](migrations/001_initial.sql) in the SQL Editor.
2. **Clerk** — Create an application at [dashboard.clerk.com](https://dashboard.clerk.com). Note the **Publishable key** (frontend) and **Secret key** (API). Set the **Issuer** (e.g. `https://xxx.clerk.accounts.dev`) for JWT verification in the API.
3. **Cloudflare Pages** — Connect your repo. Set:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Environment variables (production):**
     - `VITE_CLERK_PUBLISHABLE_KEY` — Clerk publishable key (visible to frontend)
     - `VITE_USE_API` — `true` to use the API instead of localStorage
   - **Secrets** (for Pages Functions only, not exposed to frontend):
     - `NEON_DATABASE_URL` — Neon connection string (e.g. `postgresql://user:pass@host.neon.tech/neondb?sslmode=require`)
     - `CLERK_ISSUER` — Clerk issuer URL (e.g. `https://xxx.clerk.accounts.dev`)
4. **API** — The app uses **Cloudflare Pages Functions** under `/functions`. Only `/api/*` routes invoke Functions (see [public/_routes.json](public/_routes.json)). The API provides CRUD and bulk endpoints for grammar, vocab, and sentences, plus a Jisho proxy at `GET /api/jisho?keyword=...`. All API requests require `Authorization: Bearer <Clerk session token>`.
5. **Optional:** Set `VITE_API_BASE` if the API is on a different origin (default is same origin).

After deployment, sign up via Clerk, then add and review items; data is stored in Neon and scoped by user.
