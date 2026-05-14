# Apply this to your Supabase project (one-time, 30 seconds)

Several tables in your Supabase database are missing because migrations were never applied to the deployed project. This causes:

- Teacher → **"Could not create class"** error
- Student → Practice tab shows **"Could not load questions"**
- Parent → Cannot redeem link codes (parent_student_links missing)
- Rate limiting on the chat API does not work

## How to fix it (one-time setup)

1. Open the SQL Editor on your Supabase project:
   **https://supabase.com/dashboard/project/glfivzdteschyfvyllqw/sql/new**

2. Run each of these two migration files in order:
   - `supabase/migrations/002_full_schema.sql` — creates tables, RLS, seeds 50+ practice questions
   - `supabase/migrations/20260412000000_claw_code_features.sql` — adds learner memory + rate limit tables

3. Click **Run** for each. Both should complete with no errors (they use `create table if not exists` so they're safe to re-run).

4. Refresh the live app. Everything should now work.

## Verifying it worked

After applying, run this in the SQL Editor:

```sql
select table_name from information_schema.tables
where table_schema = 'public'
order by table_name;
```

You should see all of these:
- chat_messages, chat_sessions, class_enrollments, feedback, learner_memory,
  lesson_views, lessons, link_codes, parent_student_links, practice_questions,
  profiles, rate_limits, teacher_classes, user_answers
