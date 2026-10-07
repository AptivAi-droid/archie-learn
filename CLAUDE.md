# Archie Learn — project rules

The Aptiv engineering manifesto (`~/.claude/CLAUDE.md`, maintained by Neal Titus) governs this repo.
Project-specific facts and approved exceptions:

## Layout
- `backend/` — CodeIgniter 4 REST API + MySQL. cPanel document root → `backend/public/`.
- `frontend/` — React 19 + Vite web app (PWA). Built to static files, served from GitHub Pages
  for now (`master` → `/archie-learn/`, `dev` → `/archie-learn/dev/`), later from cPanel.
- `docs/API.md` — the REST contract between them. Change it first, then both sides.
- `legacy/` — retired Supabase/Netlify implementation, kept for reference only. Do not build on it.

## Approved exceptions to the manifesto (Neal Titus, 2026-10-07)
- **CodeIgniter 4.7.x instead of 4.4** — every 4.4.x release carries unpatched security advisories
  (Composer blocks them) and this app holds minors' data under POPIA.
- **React web frontend** (not Expo) for Archie Learn for now — fastest path to the student pilot.
  Data access goes only through the CI4 API (no Supabase, no direct DB access from the browser).

## Product rules
- Learners are Grade 8–12 minors: safeguarding text in the tutor system prompt is mandatory,
  POPIA applies, students join classes only by entering the teacher's code (consent).
- Tutoring: `claude-sonnet-5-5` (effort `low`). Marking: `claude-haiku-4-5`. The server builds every
  prompt; the browser never sends a system prompt or model answers.
- No quiz-based assessment of learning style (behavioural inference only).
