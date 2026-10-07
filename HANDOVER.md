# Archie Learn — handover / what is still needed

_Last updated: 2026-10-07. Owner: Neal Titus (Aptiv Consulting). Confidential — NDA applies._

## What this is

Archie Learn is a CAPS-aligned AI study partner for South African learners in Grades 8–12. It has an AI tutor,
practice questions with AI marking, progress tracking, parent linking and teacher classes.

| Part | Folder | Technology | Where it runs |
|---|---|---|---|
| Web app | `frontend/` | React 19 + Vite + Tailwind 4 (static files) | GitHub Pages now (`https://aptivai-droid.github.io/archie-learn/dev/`); can move to cPanel |
| API | `backend/` | CodeIgniter 4.7 + Shield + PHP 8.2+ | **Not hosted yet** — target: Aptiv cPanel |
| Database | `backend/app/Database/Migrations` | MySQL 9.7 (InnoDB, utf8mb4) | **Not created yet** — target: Aptiv cPanel |
| Contract | `docs/API.md` | REST `/api/v1`, Bearer tokens | — |
| Old version | `legacy/` | Supabase + Netlify (retired, reference only) | Supabase project is paused/gone |

Branches: `master` = production, `dev` = pilot/testing. Work happens on `dev`; merge to `master` only after
tests pass and the pilot is signed off.

## Why login doesn't work today

The app was built on Supabase (a hosted database + login service). That Supabase project
(`glfivzdteschyfvyllqw`) was paused and no longer exists on the internet, so every login fails. Neal decided
on 2026-10-07 to move the backend to our own cPanel servers like our other tools instead of restoring it.
The new CodeIgniter backend is being built on `dev`; until it is hosted, the web app shows
"Can't reach the Archie server".

## Status

- [x] Root cause of the login failure found (Supabase project gone)
- [x] Dev environment: `dev` branch deploys to `/archie-learn/dev/` without touching production
- [x] Web app ported off Supabase onto the REST API (on `dev`)
- [ ] CodeIgniter backend finished and pushed to `dev` (in progress)
- [ ] Backend tests green in GitHub Actions against MySQL 9.7 (`.github/workflows/backend.yml`)
- [ ] Independent code review against the Aptiv manifesto (Gate 4 checklist)
- [ ] **Backend hosted on cPanel** — needs IT (see below)
- [ ] Pilot with real students on the dev site
- [ ] Merge `dev` → `master` (production)

## What IT needs to provide / do

### 1. cPanel hosting for the API (dev/pilot first, production later)
- A subdomain, e.g. `api-dev.<our-domain>` (and later `api.<our-domain>`), with HTTPS (AutoSSL).
- **Document root → `<install path>/backend/public/`** — never the `backend/` folder itself
  (`app/`, `vendor/`, `writable/` and `.env` must not be web-accessible).
- PHP **8.2 or newer** with extensions: `intl`, `mbstring`, `mysqli`, `curl`, `json`, `openssl`.
- SSH or Terminal access to run `composer` and `php spark` (or build `vendor/` locally and upload it).

### 2. MySQL database
- A database + user, e.g. `aptiv_archie_dev`. MySQL 9.7 preferred (the tests run on 9.7); 8.x is likely fine.
- The audit log must be tamper-proof: after migrations, restrict the app user on that table to
  `GRANT SELECT, INSERT ON <db>.audit_log TO '<app_user>'@'localhost';` (no UPDATE/DELETE).

### 3. Secrets for `backend/.env` (never committed — template in `backend/.env.example`)
- Database host/name/user/password.
- `ANTHROPIC_API_KEY` — Anthropic API key for the tutor and marking (Neal to supply/approve billing).
- SMTP account for password-reset emails (host, port, username, password, from-address),
  e.g. `noreply@<our-domain>`.
- `app.baseURL` = the API URL; `FRONTEND_URL` = the web app URL; CORS allowed origins = the web app origin.

### 4. Deploy steps (once 1–3 exist) — full detail in `backend/README.md`
```bash
cd backend
composer install --no-dev --optimize-autoloader
cp .env.example .env        # fill in values; chmod 600 .env
php spark migrate --all
php spark db:seed <PracticeQuestion seeder — see backend/README.md>
php spark archie:make-admin neal@aptiv.co.za   # after Neal registers
chmod -R 755 writable
```
Check `https://api-dev.<our-domain>/api/v1/health` returns `{"ok":true,"db":true}`.

### 5. Point the web app at the API
- GitHub → repo → Settings → Secrets and variables → Actions → **Variables** → add
  `VITE_API_URL_DEV = https://api-dev.<our-domain>` (and later `VITE_API_URL_PROD`), then re-run the
  "Deploy to GitHub Pages" workflow.
- Note: GitHub Pages only works from the public `AptivAi-droid/archie-learn` repo; a **private** repo on our
  free GitHub organisation plan can't use Pages. Long term, host the built `frontend/dist` on cPanel as well.

### 6. Access
- Developers/IT need read access to this repo; Neal approves merges to `master`.

## Contacts
- Product owner / approvals: Neal Titus — neal.titus@aptiv.co.za
