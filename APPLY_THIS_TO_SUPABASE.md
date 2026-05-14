# Two Supabase fixes to unlock the pilot (5 minutes total)

You own the Supabase project under `nealtitus4823@gmail.com`. Log into [supabase.com/dashboard](https://supabase.com/dashboard) with that Google account.

---

## Fix 1 — Apply the missing database tables (unlocks Teacher, Practice, Parent linking)

**Why:** The deployed Supabase project is missing 8 tables that the app code expects. This is why:
- Teacher → "Create class" errors with "Could not create class. Please try again."
- Student → Practice tab shows "Could not load questions"
- Parent → Cannot redeem child link codes

**How to fix (one paste, 30 seconds):**

1. Open the SQL Editor:
   **https://supabase.com/dashboard/project/glfivzdteschyfvyllqw/sql/new**

2. Open the file `SUPABASE_SETUP.sql` in this repo (it's a consolidated copy of the two unapplied migrations).

3. Paste its entire contents into the SQL Editor.

4. Click **Run**.

5. Refresh the live app. Teacher Create-class, Practice, and Parent linking all start working immediately. 50+ CAPS-aligned practice questions are seeded automatically.

If you see any "policy already exists" or "type already exists" warnings, those are safe — the SQL uses `IF NOT EXISTS` everywhere so it's safe to re-run.

---

## Fix 2 — Stop blocking new signups on Supabase's flaky email mailer

**Why:** Supabase's default email service (Mailgun) is rate-limited and often filters/drops emails to fresh Gmail / Outlook / business addresses. When you tried to sign up using your business email, the verification email never arrived. Your pilot testers will hit the same problem.

**Two options — pick one:**

### Option A — Disable email confirmation entirely (recommended for the pilot)

1. Go to **Auth → Sign In / Up** (or "Providers" → "Email"):
   **https://supabase.com/dashboard/project/glfivzdteschyfvyllqw/auth/providers**

2. Find the **Email** provider.

3. Toggle **"Confirm email"** to **OFF**.

4. Save.

Now any user who signs up can immediately log in. No email round-trip required.

Your 7 pre-created pilot accounts (`learnertest1@`, `teacher1@`, `parent1@`, etc.) already have `email_confirmed_at` set so they were never affected — but new self-signups will now work straight away.

### Option B — Custom SMTP (for full production launch later)

1. Sign up at [resend.com](https://resend.com) (free up to 3 000 emails/month, 5 minutes to set up) or [postmarkapp.com](https://postmarkapp.com).

2. Verify your sending domain (DNS records).

3. In Supabase Dashboard → **Auth → SMTP Settings**, paste your SMTP credentials.

4. Save. New verification emails now go via your SMTP — 100% delivery rate.

Keep Option A on for the pilot, switch to Option B before a public launch.

---

## Verifying it worked

After applying both fixes, run this in the SQL Editor:

```sql
select table_name from information_schema.tables
where table_schema = 'public'
order by table_name;
```

You should see all 14 tables:

`buddy_companions, chat_messages, chat_sessions, class_enrollments, curricula,
feedback, learner_memory, lesson_views, lessons, link_codes,
parent_student_links, practice_questions, profiles, rate_limits,
teacher_classes, ultraplans, user_answers`

And check the auth setting:

```sql
select raw_app_meta_data->>'provider', count(*) from auth.users group by 1;
```

Then test on the live app: sign up with any new email. You should be logged in immediately (Option A), with no "Check your email" screen.

---

## What to tell pilot testers

Until Fix 1 is applied:
- **Students** can fully use the app (chat with Archie, view lessons, track progress)
- **Teachers** can log in and see their dashboard but can't create classes yet
- **Parents** can log in and see the link-code prompt but linking won't complete

After Fix 1 + 2 are applied, every flow works as designed.
