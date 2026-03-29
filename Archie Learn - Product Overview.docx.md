# Archie Learn — Product Overview

## What Is Archie Learn?

Archie Learn is an AI-powered personal tutor built specifically for South African high school students in Grades 8-12. It uses advanced conversational AI (Anthropic's Claude) to deliver one-on-one tutoring sessions that are fully aligned with the CAPS curriculum across five core subjects: Mathematics, Physical Sciences, English Home Language, Life Sciences, and Accounting.

Unlike generic AI chatbots or answer engines, Archie is designed to **teach** — not just answer. It uses the Socratic method, guiding learners through problems step by step, celebrating their progress, and never giving away answers until the student has genuinely attempted the work.

---

## How It Works

1. **Student logs in** on their phone (mobile-first, works on any smartphone browser)
2. **Picks their subject** — can switch between subjects at any time during a session
3. **Starts chatting with Archie** — asks about homework, exam prep, concepts they're stuck on
4. **Archie guides them** through problems using questions, hints, and encouragement
5. **Feedback is collected** every 10 messages to track the learning experience
6. **Parents** can view weekly progress summaries in a dedicated parent view
7. **Admins/Teachers** can review all sessions, feedback, and transcripts via a dashboard

---

## The Three User Roles

| Role | What They See |
|------|--------------|
| **Student** | AI chat tutor, subject switcher, progress tracker |
| **Teacher** | Session transcripts, feedback data, CSV exports (via admin dashboard) |
| **Parent** | Weekly summary, sessions count, Archie's personalised notes |

---

## What Makes Archie Learn Different

### 1. Built for South Africa, Not Adapted for It

Most AI tutoring tools are built for American or European curricula and then loosely "localised." Archie Learn is **built from the ground up for CAPS** — the South African Curriculum and Assessment Policy Statement. Every explanation, every example, every problem-solving approach is framed within what SA learners are actually being tested on.

**Competitors like Khanmigo** (Khan Academy's AI tutor) are explicitly **restricted to U.S. residents only** and follow American Common Core standards. South African students can't even sign up.

**Siyavula** is CAPS-aligned and excellent for Maths and Physical Sciences practice, but it's an **adaptive question bank**, not a conversational tutor. Students drill exercises — they don't have a dialogue. If a learner is confused about *why* something works, Siyavula can't explain it in conversation.

**FoondaMate and Luma Learn** operate via WhatsApp, which is clever for accessibility, but WhatsApp's interface severely limits the depth of a tutoring interaction. There's no session history, no progress tracking, no parent view, and no admin dashboard.

### 2. Socratic Method — It Refuses to Give You the Answer

This is the core pedagogical difference. Archie follows 10 strict teaching rules:

- **Never gives the answer directly** — always asks the learner to attempt first
- **Gives hints after 2 failed attempts**, walks through the solution after 3
- **Always acknowledges what the learner got right** before correcting
- **Keeps responses short** (3-5 sentences) to avoid overwhelming
- **Uses South African context** — taxi fares, spaza shops, rands and cents, local place names
- **Celebrates wins explicitly** — "Sharp sharp!", "That's it!", "You've got it now."
- **Responds to frustration with warmth** before attempting explanation

Most AI tutoring apps (Photomath, Socratic by Google, Brainly) do the opposite — they give instant answers. This trains students to **depend on the tool** rather than **develop understanding**. Archie trains students to think.

**Khanmigo** also uses the Socratic approach, but again — it's U.S. only and costs $44/year.

### 3. Conversational, Not Clinical

Archie speaks like a knowledgeable friend, not a textbook. It uses natural conversational language appropriate to the learner's grade level. No bullet points, no robotic formatting — just a warm, encouraging study partner who happens to know the entire CAPS syllabus.

**TutorFlow** and **Thuto AI** are emerging SA competitors with CAPS alignment, but they focus primarily on step-by-step problem solving (especially Maths). Archie covers all five major subjects conversationally.

### 4. Three-Sided Platform (Student + Parent + Teacher)

No competitor in the South African market offers an integrated view for all three stakeholders:

| Feature | Archie Learn | Siyavula | FoondaMate | Luma Learn | TutorFlow |
|---------|:---:|:---:|:---:|:---:|:---:|
| CAPS-aligned | Yes | Yes (Maths/Science) | Partial | Yes | Yes (Maths/Science) |
| AI conversational tutor | Yes | No (adaptive questions) | WhatsApp only | WhatsApp only | Limited |
| Socratic method | Yes | No | No | No | No |
| Subject flexibility (switch mid-session) | Yes | No | No | No | No |
| Parent progress view | Yes | No | No | No | No |
| Teacher/admin dashboard | Yes | Yes (school plans) | No | No | No |
| Session transcripts reviewable | Yes | No | No | No | No |
| Feedback collection system | Yes | No | No | No | No |
| Mobile-first design | Yes | Yes | Yes (WhatsApp) | Yes (WhatsApp) | Yes |
| Free for students | Pilot (free) | Free (zero-rated) | Free | Free | Freemium |

### 5. Data-Driven Pilot Testing

Archie Learn includes a built-in **admin dashboard** that tracks:
- Session counts per user
- Average feedback ratings
- What worked / what frustrated learners (qualitative data)
- Full chat transcripts (reviewable and exportable as CSV)
- User activity and engagement metrics

This means the product generates its own evidence base from day one. After the pilot, we'll have real data on learning engagement, session quality, and user satisfaction — not just assumptions.

---

## The South African EdTech Gap

South Africa faces a unique combination of challenges:

- **Teacher shortages** — particularly in Maths and Sciences in rural areas
- **Data costs** — students can't afford to stream video lessons or download large apps
- **Curriculum specificity** — global tools don't teach what SA students are actually examined on
- **Language and cultural context** — examples about dollars, Fahrenheit, and American football don't resonate

Archie Learn addresses all four:
- Available 24/7 as a lightweight web app (no download required)
- Text-based tutoring uses minimal data
- 100% CAPS-aligned content
- South African examples, slang, and cultural context built into the AI's personality

---

## Technical Architecture

- **Frontend:** React (mobile-first), Tailwind CSS — runs in any modern browser
- **AI Engine:** Anthropic Claude (claude-sonnet-4-6) — via Supabase Edge Functions
- **Database:** Supabase (PostgreSQL) with row-level security
- **Auth:** Supabase Auth with pre-created accounts (no email verification needed for pilot)
- **Hosting:** Static site deployment — works on GitHub Pages, Netlify, or Vercel

---

## Pilot Plan

**6 testers + 2 admins:**
- 2 Students (Grades 8-12)
- 2 Teachers
- 2 Parents
- 2 Admins (Neal + 1 additional)

**Duration:** 1-2 weeks
**Goal:** Validate the tutoring experience, collect feedback, review session quality

---

## Vision

Archie Learn is not trying to replace teachers. It's trying to give every South African learner access to a patient, knowledgeable study partner who is available at 9pm on a Sunday night when exams are on Monday — something that has never existed at scale in South Africa before.

The long-term roadmap includes:
- Multi-language support (isiZulu, Afrikaans, isiXhosa)
- Voice input/output for accessibility
- Exam prep mode with timed practice
- Teacher tools for creating custom assignments
- Premium family plans with detailed analytics

---

*Built by Aptiv Consulting | Powered by Anthropic Claude AI*
*Contact: nealtitus@aptivconsulting.com*
