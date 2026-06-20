# Archie Learn — Deployment & Production Readiness

This doc is the single source of truth for getting Archie Learn fully working in
production. It separates what is **done in code** from what still needs a **human
with dashboard access** (Supabase, hosting provider, GitHub repo secrets).

---

## 1. How it's currently deployed

- **Frontend:** GitHub Pages, via `.github/workflows/deploy.yml` (push to `master`).
- **Base path:** `vite.config.js` sets `base: '/archie-learn/'`, so the live URL is
  `https://aptivai-droid.github.io/archie-learn/`.
- **Important:** GitHub Pages serves **static files only**. It **cannot** run the
  serverless code in `netlify/functions/`. `netlify.toml` is therefore inert on the
  current host — its redirects do nothing on GitHub Pages.

---

## 2. AI Chat & Practice — why they're dead in production, and how to fix

Both screens call a backend:

- `src/screens/Tutor.jsx`  → `VITE_CHAT_API_URL` || `/api/chat`
- `src/screens/Practice.jsx` → `VITE_MARK_API_URL` || `/api/mark`

In **local dev** these are served by `server/index.js` (Express, port 3001) via the
Vite proxy — run `npm run dev:all`. (The `/api/mark` route was previously missing and
has now been added so Practice works in dev.)

In **production** there is no backend, so both fall back to same-origin `/api/*`,
which on GitHub Pages are static 404s. The Anthropic key must stay server-side, so the
fix is to **deploy a backend** and point the two env vars at it.

### Path A — Keep GitHub Pages, host functions on Netlify (recommended, least friction)

1. Create a Netlify site from this repo (or `netlify deploy`). Netlify will build the
   `netlify/functions/` (config already in `netlify.toml`).
2. In **Netlify → Site settings → Environment variables** set:
   - `ANTHROPIC_API_KEY`
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`  (used by `chat.js` for rate-limiting/memory)
   - `ALLOWED_ORIGIN = https://aptivai-droid.github.io`  (locks CORS to the Pages site)
3. In **GitHub → repo → Settings → Secrets and variables → Actions** add:
   - `VITE_CHAT_API_URL = https://<your-site>.netlify.app/.netlify/functions/chat`
   - `VITE_MARK_API_URL = https://<your-site>.netlify.app/.netlify/functions/mark`
   `deploy.yml` already forwards these into the build.
4. Re-run the Pages deploy. The functions already emit `Access-Control-Allow-*`
   headers, so the cross-origin Pages → Netlify call works.

### Path B — Move hosting fully to Netlify (one origin, more change)

- Set `vite.config.js` `base: '/'`, remove/disable `.github/workflows/deploy.yml`,
  and let Netlify serve both the SPA and the functions. Cleaner long-term, but it
  changes the public URL and retires the Pages pipeline. **Needs Neal's sign-off.**

> Decision needed from Neal: **Path A or Path B?** The repo currently ships *both*
> a Pages workflow and a `netlify.toml`, which is contradictory. Pick one.

---

## 3. Supabase — BLOCKED (needs SQL editor / dashboard access)

**Project:** `glfivzdteschyfvyllqw` → `https://glfivzdteschyfvyllqw.supabase.co`
**Account:** owned under the Google account **nealtitus4823@gmail.com** — log in at
https://supabase.com/dashboard with that account.
**SQL editor:** https://supabase.com/dashboard/project/glfivzdteschyfvyllqw/sql/new

These scripts live in the repo but have **not** been applied to the live database.
Run them in **Supabase → SQL Editor**, in order:

1. `SUPABASE_SETUP.sql` — base schema (creates `teacher_classes`, `practice_questions`,
   `class_enrollments`, `link_codes`, etc. — without these, Teacher/Practice/Parent
   flows fail).
2. `SUPABASE_FIX_RLS.sql` — fixes the RLS recursion.
3. `SUPABASE_PHASE2.sql`, `SUPABASE_PHASE3.sql` — role-escalation trigger + signup
   enforcement.

See `APPLY_THIS_TO_SUPABASE.md` for the detailed apply order.

## 4. Email confirmation — BLOCKED (needs Auth dashboard)

Supabase's default mailer drops messages, so self-signups can't verify. Either:
- **Supabase → Authentication → Providers → Email:** turn *Confirm email* **off** for
  now, **or**
- Configure custom SMTP (Resend recommended) under **Authentication → Emails → SMTP**.

---

## 4b. Google sign-in — BLOCKED (needs Google Cloud + Supabase dashboard)

The code path is fully wired: `FEATURES.GOOGLE_OAUTH = true`, a "Continue with Google"
button on both Login and Signup (shared `src/components/GoogleButton.jsx`), and
`signInWithGoogle()` in `AuthContext`. To make it actually work, do this ONCE:

1. **Google Cloud Console** → create an OAuth 2.0 Client ID (type: Web application).
   - Authorised redirect URI: `https://glfivzdteschyfvyllqw.supabase.co/auth/v1/callback`
   - Copy the Client ID + Client Secret.
2. **Supabase → Authentication → Providers → Google** → enable, paste Client ID +
   Secret, Save.
3. **Supabase → Authentication → URL Configuration → Redirect URLs** → add:
   `https://aptivai-droid.github.io/archie-learn/setup`
   (plus `http://localhost:5173/archie-learn/setup` for local dev).

Until step 2 is done, the Google button shows a friendly "not available yet" message
instead of crashing.

**Caveat (POPIA):** Google sign-up skips the email Signup screen's date-of-birth
age-gate (the <13 block and adult→/apply routing); Google users are created as
`student` by the DB trigger. For a POPIA-clean public launch, also collect DOB on
ProfileSetup for OAuth users. Acceptable for a controlled pilot.

---

## 5. Outstanding (code/content backlog — not blockers)

- **CAPS content** for the 4 newer subjects: **Accounting (Gr 8–12, 27 topics) and
  Mathematical Literacy (Gr 10–12, 16 topics) are now authored and registered** in
  `src/data/caps/index.js`. **Geography and Business Studies (Gr 8–12)** follow the
  same `src/data/caps/history.js` pattern and are registered the same way.
- **Service worker (offline PWA):** the manifest is now in place (`public/manifest.webmanifest`)
  so the app is installable, but there is no service worker yet. A correct one must
  scope to `/archie-learn/` and use a safe cache strategy — deferred to avoid shipping
  stale-asset bugs.
- **OG raster image:** social meta currently points at `favicon.svg`. Add a 1200×630
  PNG (e.g. `public/og-image.png`) and update the `og:image`/`twitter:image` URLs in
  `index.html` for proper link previews.
