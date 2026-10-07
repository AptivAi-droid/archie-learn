# Archie Learn — REST API contract (v1)

Backend: CodeIgniter 4.7 + Shield + MySQL (`backend/`). Frontend: React web app (`frontend/`).
This file is the contract between them. Change it first, then both sides.

## Conventions

- Base URL: `{API_URL}/api/v1` — `API_URL` comes from the frontend env `VITE_API_URL`
  (e.g. `https://api.archielearn.co.za`). Local dev: `http://localhost:8080`.
- JSON in, JSON out. `Content-Type: application/json`.
- Auth: Shield **access tokens**. Send `Authorization: Bearer <token>` on every route marked 🔒.
  Tokens are returned by register/login and revoked by logout.
- IDs, scores, marks, grades and ratings are JSON **numbers** (cast MySQL strings server-side). IDs are MySQL `BIGINT UNSIGNED`. Timestamps are ISO-8601 strings in UTC
  (`2026-10-07T10:15:00Z`).
- Success: `200`/`201` with the documented body (no envelope).
- Errors: `{ "error": "Human-readable message for the learner", "errors": { "field": "msg" } }`
  (`errors` only on validation failures). Status codes: `400` bad input, `401` not logged in /
  bad token, `403` wrong role / not yours, `404` not found, `409` conflict, `422` validation,
  `429` rate limited, `502` AI service failed, `500` server.
- CORS: allowed origins from backend `.env` `cors.allowedOrigins` (GitHub Pages origin
  `https://aptivai-droid.github.io` + `http://localhost:5173`). Preflight `OPTIONS` must pass.
- Roles: `student`, `parent`, `teacher`, `admin` (single role per user, stored on the profile).
- A **profile** object everywhere:
  ```json
  { "id": 12, "email": "a@b.co.za", "role": "student", "first_name": "Thandi", "last_name": null,
    "grade": 10, "primary_subject": "Mathematics", "subjects": ["Mathematics"], "school": null,
    "dob": "2010-03-01", "companion": null, "setup_complete": true,
    "created_at": "…", "updated_at": "…" }
  ```
  `setup_complete` = student has `first_name`, `grade`, `primary_subject`; adults have `first_name`.

## Health

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/health` | – | – | `{ "ok": true, "db": true, "version": "1" }` |

## Auth & profile

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/auth/register` | – (throttled) | `{ email, password, dob }` | `201 { token, profile }` — students only. `dob` → age 13–19 required: `<13` → `422 "Archie is for learners aged 13 and up."`; `≥18` → `422` with `"code": "ADULT"` (frontend routes adults to /apply). Password ≥ 8 chars. Duplicate email → `409`. |
| POST | `/auth/login` | – (throttled) | `{ email, password }` | `{ token, profile }`. Bad creds → `401 "That email and password don't match."` |
| POST | `/auth/logout` | 🔒 | – | `{ ok: true }` (revokes current token) |
| GET | `/me` | 🔒 | – | `{ profile }` |
| PUT | `/me/profile` | 🔒 | any of `{ first_name, last_name, grade, primary_subject, subjects, school, companion }` | `{ profile }`. `role` and `email` are NOT writable here. `grade` 8–12. |
| PUT | `/me/password` | 🔒 | `{ current_password, new_password }` | `{ ok: true }` |
| POST | `/auth/password/forgot` | – (throttled) | `{ email }` | always `{ ok: true }` (no account enumeration). Emails link `{FRONTEND_URL}reset-password?token=<token>` (valid 60 min, single use). |
| POST | `/auth/password/reset` | – (throttled) | `{ token, password }` | `{ ok: true }`; invalid/expired → `400 "This reset link is invalid or has expired."` |

## Adult applications (teachers / parents)

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/applications` | – (throttled) | `{ email, password, role: "teacher"\|"parent", dob, application_data: {…} }` | `{ status: "APPROVED"\|"NEEDS_REVIEW"\|"REJECTED", message, token? , profile? }`. Age must be ≥18. Claude (Sonnet 5.5) vets `application_data`; APPROVED creates the user with that role and returns a token; NEEDS_REVIEW stores the application for an admin; REJECTED stores it. AI failure → NEEDS_REVIEW (fail safe). |

## Tutor chat (student)

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/chat/messages` | 🔒 student | `{ session_id: number\|null, subject, content }` | `{ session_id, reply: { role: "assistant", content, created_at } }`. If `session_id` is null the server creates a session for `subject` and stores the greeting `"Hey {first_name}! What are we working on today?"` first. The server stores the learner message, loads the last 20 messages of that session from the DB (the client does NOT send history), builds the system prompt from the profile (incl. safeguarding), calls Claude, stores and returns the reply. `429` with learner-friendly message when over `CHAT_RATE_LIMIT`/hour. `502` on AI failure (learner message stays saved; the error body includes `session_id` so the client keeps using it). `content` ≤ 2000 chars. |
| GET | `/chat/sessions/{id}/messages` | 🔒 owner | – | `[{ role, content, created_at }]` |

## Practice (student)

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/practice/questions?subject=&grade=&limit=5` | 🔒 student | – | `[{ id, subject, grade, topic, question_text, marks, difficulty }]` — random pick server-side. **Never includes `model_answer`.** |
| POST | `/practice/answers` | 🔒 student | `{ question_id, answer }` | `{ score, max_marks, feedback, encouragement }`. Server loads question + model answer, marks with Claude Haiku 4.5, clamps score to `0..marks`, stores the `user_answers` row itself. `429` over `MARK_RATE_LIMIT`/hour. `502` on AI failure (nothing stored). `answer` ≤ 3000 chars. |

## Lessons (student)

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/lessons/views` | 🔒 student | `{ subject, grade, topic_key }` (`topic_key` = `"{subject}::{grade}::{topicName}"`) | `201 { ok: true }` |

## Progress (student)

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/progress` | 🔒 student | – | `{ sessions: [{ id, subject, created_at }], answers: [{ question_id, subject, ai_score, max_marks, answered_at }], lesson_views: [{ subject, topic_key, created_at }] }` — sessions/lessons last 90 days, answers last 200, newest first. Frontend computes streaks/averages as today. |

## Companion / buddy (student)

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/buddy` | 🔒 student | – | `{ buddy_data: object\|null }` |
| PUT | `/buddy` | 🔒 student | `{ buddy_data: object }` (≤ 16 KB JSON) | `{ buddy_data }` |

## Parent ↔ student linking

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/link-codes` | 🔒 student | – | `201 { code, expires_at }` — 6-char uppercase code, valid 24 h, replaces any unused code. |
| POST | `/parent/links` | 🔒 parent (throttled) | `{ code }` | `201 { student: { id, first_name, grade } }`. Bad/used/expired → `400` with one generic message `"That code didn't work. Ask your child for a new code."`. |
| GET | `/parent/students` | 🔒 parent | – | `[{ id, first_name, last_name, grade, primary_subject }]` |
| GET | `/parent/students/{id}/activity` | 🔒 linked parent | – | `{ student: profile-subset, sessions: […], answers: […] }` (same shapes as `/progress`) |

## Classes (teacher creates, student joins with a code — the student's consent)

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/teacher/classes` | 🔒 teacher | – | `[{ id, name, subject, grade, join_code, student_count, created_at }]` |
| POST | `/teacher/classes` | 🔒 teacher | `{ name, subject?, grade? }` | `201 { class }` with generated 8-char `join_code` |
| DELETE | `/teacher/classes/{id}` | 🔒 owner teacher | – | `{ ok: true }` |
| GET | `/teacher/classes/{id}/activity` | 🔒 owner teacher | – | `{ students: [{ id, first_name, last_name, grade, primary_subject }], sessions: [{ user_id, subject, created_at }], answers: [{ user_id, ai_score, max_marks, answered_at }] }` (last 30 days) |
| DELETE | `/teacher/classes/{id}/students/{studentId}` | 🔒 owner teacher | – | `{ ok: true }` |
| POST | `/classes/join` | 🔒 student (throttled) | `{ code }` | `201 { class: { id, name, subject, grade, teacher_first_name } }`; bad code → `400 "That class code didn't work. Check it with your teacher."`; already joined → `200` same body. |
| GET | `/me/classes` | 🔒 student | – | `[{ id, name, subject, grade, teacher_first_name }]` |
| DELETE | `/me/classes/{id}` | 🔒 student | – | `{ ok: true }` (leave class) |

## Feedback

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/feedback` | 🔒 any | fields FeedbackModal collects (see legacy schema `feedback`) | `201 { ok: true }` |

## Admin

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/admin/overview` | 🔒 admin | – | `{ profiles: [...], feedback: [...], sessions: [{ id, user_id, subject, created_at, message_count }], applications: [{ id, email, requested_role, dob, application_data, ai_decision, ai_confidence, ai_reasoning, ai_red_flags, admin_decision, admin_notes, status, created_at }] }` (latest 200 each; `ai_red_flags` array, `application_data` object) |
| GET | `/admin/sessions/{id}/messages` | 🔒 admin | – | `[{ role, content, created_at }]` |
| PUT | `/admin/applications/{id}` | 🔒 admin | `{ status: "APPROVED"\|"REJECTED", notes? }` | `{ application }` — APPROVED creates/activates the account with the applied role. |

## Audit

Every insert/update/delete on application tables writes an `audit_log` row (table_name, record_id,
action, old_values JSON, new_values JSON, user_id, ip_address, user_agent, created_at). The app
never updates or deletes `audit_log`; production MySQL user gets INSERT/SELECT only on it.

## Backend clarifications (as implemented)

These fill gaps in the tables above; they do not change any documented shape.

- **IDs of people.** A profile's `id`, and every `user_id` / `student.id`, is the Shield `users.id`
  (`INT UNSIGNED`, a JSON number). `{studentId}` in URLs is that id.
- **Ownership.** A resource that exists but isn't yours → `403`; one that doesn't exist → `404`.
  This applies to chat sessions (`GET /chat/sessions/{id}/messages` and `POST /chat/messages` with a
  foreign `session_id`), teacher classes, and parent activity (unlinked student → `403`).
- **Throttled routes** (`throttle` per IP) answer `429 { error }` with a `Retry-After` header.
- **Unknown routes** → `404 { "error": "Not found." }`. Unexpected server errors → `500 { error }`.
- `POST /auth/register` adult response: `422 { error, code: "ADULT" }`.
- `PUT /me/password`: wrong `current_password` → `400`; `new_password` < 8 chars → `422`.
- `POST /auth/password/reset` also signs the user out everywhere (all access tokens revoked).
- `POST /chat/messages` with `session_id: null` needs `subject` (falls back to the profile's
  `primary_subject`; neither → `422`). On a refusal from Claude's safety classifiers the reply is a
  fixed learner-safe message (still `200`).
- `GET /practice/questions`: `subject` is required; `grade` optional; `limit` 1–20 (default 5).
  `topic` is `null` for the seeded question bank.
- `POST /practice/answers`: Claude refusal or unparseable marking → `502` (nothing stored).
- `POST /applications`: always `200` with `{ status, message, token?, profile? }`. Also: existing
  account for the email → `409`; more than 3 applications per email in 24 h → `429`; age < 18 → `422`.
  APPROVED from Claude is only honoured with confidence ≥ 0.85 and no red flags (otherwise
  NEEDS_REVIEW).
- `GET /admin/overview` application items additionally carry `created_user_id` and `reviewed_at`.
  `feedback` items: `{ id, user_id, session_id, rating, what_worked, what_frustrated, created_at }`.
- `PUT /admin/applications/{id}` APPROVED creates the account with the password the applicant chose
  (stored hashed only while pending). If it is no longer held (e.g. previously rejected) → `409`.
- `POST /feedback` body: `{ rating: 1–5, session_id?, what_worked?, what_frustrated? }`
  (`session_id` is dropped unless it is the caller's own session).
