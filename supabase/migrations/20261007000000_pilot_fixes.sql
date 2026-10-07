-- ============================================================================
-- 20261007000000_pilot_fixes.sql
-- Archie Learn — pilot hardening. FULLY IDEMPOTENT: safe to run any number of
-- times, on a fresh project (after the earlier scripts) or an existing one.
--
--  a. feedback table + RLS
--  b. profiles: first_name / grade / primary_subject nullable (teachers, parents)
--  c. is_admin() + admin SELECT policies
--  d. parent SELECT on user_answers
--  e. teacher policies via SECURITY DEFINER helpers (no RLS recursion)
--  f. learner_memory / curricula / ultraplans: remove USING (true) write policies
--  g. link codes: no broad SELECT/UPDATE; redeem via redeem_link_code()
--  h. enroll_student_by_email()
--  i. rate limiting via bump_rate_limit()
--  j. lesson_views.lesson_id nullable + topic_key
--  k. practice_questions natural-key unique index (after de-duplication)
--  +  search_path hardening on pre-existing SECURITY DEFINER functions
-- ============================================================================

-- ── a. Feedback ─────────────────────────────────────────────────────────────
create table if not exists public.feedback (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  session_id uuid references public.chat_sessions(id) on delete set null,
  rating integer check (rating between 1 and 5),
  what_worked text,
  what_frustrated text,
  created_at timestamptz not null default now()
);
-- In case an older, partial feedback table already exists
alter table public.feedback add column if not exists session_id uuid;
alter table public.feedback add column if not exists rating integer;
alter table public.feedback add column if not exists what_worked text;
alter table public.feedback add column if not exists what_frustrated text;
alter table public.feedback add column if not exists created_at timestamptz not null default now();

create index if not exists idx_feedback_user on public.feedback(user_id);
create index if not exists idx_feedback_created on public.feedback(created_at desc);

alter table public.feedback enable row level security;

drop policy if exists "Users can insert own feedback" on public.feedback;
create policy "Users can insert own feedback" on public.feedback
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users can view own feedback" on public.feedback;
create policy "Users can view own feedback" on public.feedback
  for select to authenticated using (auth.uid() = user_id);

-- ── b. Profiles: adult roles have no grade / subject ────────────────────────
alter table public.profiles alter column first_name drop not null;
alter table public.profiles alter column grade drop not null;
alter table public.profiles alter column primary_subject drop not null;
-- The existing CHECK (grade between 8 and 12) still applies to non-null grades.

-- ── c/e. SECURITY DEFINER helpers (bypass RLS → no policy recursion) ────────
create or replace function public.is_admin()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_teacher_of(p_student uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1
    from public.class_enrollments ce
    join public.teacher_classes tc on tc.id = ce.class_id
    where ce.student_id = p_student
      and tc.teacher_id = auth.uid()
  );
$$;

create or replace function public.is_parent_of(p_student uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.parent_student_links
    where parent_id = auth.uid()
      and student_id = p_student
      and confirmed = true
  );
$$;

-- Also defined in SUPABASE_FIX_RLS.sql; repeated so this file stands alone.
create or replace function public.is_teacher_of_class(c_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.teacher_classes where id = c_id and teacher_id = auth.uid()
  );
$$;

create or replace function public.is_student_in_class(c_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.class_enrollments where class_id = c_id and student_id = auth.uid()
  );
$$;

-- ── c. Admin read policies ──────────────────────────────────────────────────
drop policy if exists "Admins read all profiles" on public.profiles;
create policy "Admins read all profiles" on public.profiles
  for select to authenticated using (public.is_admin());

drop policy if exists "Admins read all feedback" on public.feedback;
create policy "Admins read all feedback" on public.feedback
  for select to authenticated using (public.is_admin());

drop policy if exists "Admins read all chat sessions" on public.chat_sessions;
create policy "Admins read all chat sessions" on public.chat_sessions
  for select to authenticated using (public.is_admin());

drop policy if exists "Admins read all chat messages" on public.chat_messages;
create policy "Admins read all chat messages" on public.chat_messages
  for select to authenticated using (public.is_admin());

drop policy if exists "Admins read all answers" on public.user_answers;
create policy "Admins read all answers" on public.user_answers
  for select to authenticated using (public.is_admin());

do $$
begin
  if to_regclass('public.signup_applications') is not null then
    execute 'drop policy if exists "Admins read all applications" on public.signup_applications';
    execute 'create policy "Admins read all applications" on public.signup_applications
               for select to authenticated using (public.is_admin())';
    execute 'drop policy if exists "Admins can update applications" on public.signup_applications';
    execute 'create policy "Admins can update applications" on public.signup_applications
               for update to authenticated using (public.is_admin()) with check (public.is_admin())';
  end if;
end $$;

-- ── d. Parents read linked students' answers ────────────────────────────────
drop policy if exists "Parents can view linked student answers" on public.user_answers;
create policy "Parents can view linked student answers" on public.user_answers
  for select to authenticated using (public.is_parent_of(user_id));

-- ── e. Teacher policies (were dropped by SUPABASE_FIX_RLS.sql) ──────────────
drop policy if exists "Teachers can view enrolled student profiles" on public.profiles;
create policy "Teachers can view enrolled student profiles" on public.profiles
  for select to authenticated using (public.is_teacher_of(id));

drop policy if exists "Teachers can view class student answers" on public.user_answers;
create policy "Teachers can view class student answers" on public.user_answers
  for select to authenticated using (public.is_teacher_of(user_id));

drop policy if exists "Teachers can see class students lesson views" on public.lesson_views;
create policy "Teachers can see class students lesson views" on public.lesson_views
  for select to authenticated using (public.is_teacher_of(user_id));

drop policy if exists "Teachers can view enrolled student sessions" on public.chat_sessions;
create policy "Teachers can view enrolled student sessions" on public.chat_sessions
  for select to authenticated using (public.is_teacher_of(user_id));

-- Non-recursive "students see their classes" (same as SUPABASE_FIX_RLS.sql)
drop policy if exists "Students can see their classes" on public.teacher_classes;
drop policy if exists "Students see enrolled classes" on public.teacher_classes;
create policy "Students see enrolled classes" on public.teacher_classes
  for select using (public.is_student_in_class(id));

-- Enrollment INSERTs now go only through enroll_student_by_email() (which checks
-- the target is a student). Teachers keep read + remove on their own classes.
drop policy if exists "Teachers manage enrollments in own classes" on public.class_enrollments;
drop policy if exists "Teachers can manage enrollments for their classes" on public.class_enrollments;
drop policy if exists "Teachers read enrollments in own classes" on public.class_enrollments;
create policy "Teachers read enrollments in own classes" on public.class_enrollments
  for select to authenticated using (public.is_teacher_of_class(class_id));
drop policy if exists "Teachers remove enrollments in own classes" on public.class_enrollments;
create policy "Teachers remove enrollments in own classes" on public.class_enrollments
  for delete to authenticated using (public.is_teacher_of_class(class_id));

-- ── f. Remove USING (true) write policies (service role bypasses RLS) ───────
drop policy if exists "Service role can write memory" on public.learner_memory;
drop policy if exists "Service role can write curriculum" on public.curricula;
drop policy if exists "Service role can insert ultraplans" on public.ultraplans;

drop policy if exists "Users can read own memory" on public.learner_memory;
create policy "Users can read own memory" on public.learner_memory
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can read own curriculum" on public.curricula;
create policy "Users can read own curriculum" on public.curricula
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can read own ultraplans" on public.ultraplans;
create policy "Users can read own ultraplans" on public.ultraplans
  for select to authenticated using (auth.uid() = user_id);

-- ── g. Link codes ───────────────────────────────────────────────────────────
drop policy if exists "Anyone authenticated can read link codes to redeem" on public.link_codes;
drop policy if exists "Parents can mark link codes as used" on public.link_codes;
-- Parents may no longer self-insert links to arbitrary students; links are created
-- only by redeem_link_code().
drop policy if exists "Parents can insert own links" on public.parent_student_links;

-- Students keep: insert own codes, read own codes (LinkCodeModal.jsx)
drop policy if exists "Students can create link codes" on public.link_codes;
create policy "Students can create link codes" on public.link_codes
  for insert to authenticated with check (auth.uid() = student_id and used = false);
drop policy if exists "Students can view own link codes" on public.link_codes;
create policy "Students can view own link codes" on public.link_codes
  for select to authenticated using (auth.uid() = student_id);

-- Students can see which parents are linked to them
drop policy if exists "Students can view own parent links" on public.parent_student_links;
create policy "Students can view own parent links" on public.parent_student_links
  for select to authenticated using (auth.uid() = student_id);

create or replace function public.redeem_link_code(p_code text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_role text;
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_row  public.link_codes%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select role into v_role from public.profiles where id = v_uid;
  if v_role is distinct from 'parent' then
    raise exception 'Only parent accounts can redeem link codes' using errcode = '42501';
  end if;

  select * into v_row from public.link_codes where code::text = v_code for update;
  if not found then
    raise exception 'Link code not found. Ask your child for a new one.';
  end if;
  if v_row.used then
    raise exception 'This link code has already been used. Ask your child for a new one.';
  end if;
  if v_row.expires_at < now() then
    raise exception 'This link code has expired. Ask your child for a new one.';
  end if;

  update public.link_codes set used = true where code = v_row.code;

  insert into public.parent_student_links (parent_id, student_id, confirmed)
  values (v_uid, v_row.student_id, true)
  on conflict (parent_id, student_id) do update set confirmed = true;

  return v_row.student_id;
end;
$$;

-- ── h. Teacher enrolls a student by email ───────────────────────────────────
create or replace function public.enroll_student_by_email(p_class_id uuid, p_email text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_student uuid;
  v_role    text;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles where id = v_uid and role in ('teacher', 'admin')
  ) then
    raise exception 'Only teacher accounts can enroll students' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.teacher_classes where id = p_class_id and teacher_id = v_uid
  ) then
    raise exception 'Class not found or you do not own it' using errcode = '42501';
  end if;

  select id into v_student
  from auth.users
  where lower(email) = lower(btrim(coalesce(p_email, '')))
  limit 1;
  if v_student is null then
    raise exception 'No student account with that email';
  end if;

  select role into v_role from public.profiles where id = v_student;
  if not found then
    raise exception 'That student has not finished setting up their profile yet';
  end if;
  if v_role <> 'student' then
    raise exception 'That email belongs to a % account, not a student', v_role;
  end if;

  insert into public.class_enrollments (class_id, student_id)
  values (p_class_id, v_student)
  on conflict (class_id, student_id) do nothing;

  return v_student;
end;
$$;

-- ── i. Rate limiting ────────────────────────────────────────────────────────
create table if not exists public.rate_limits (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  endpoint text not null,
  window_start timestamptz not null default now(),
  request_count integer not null default 1
);
-- Drop any duplicate windows (disposable data) before enforcing uniqueness
delete from public.rate_limits a
using public.rate_limits b
where a.user_id = b.user_id
  and a.endpoint = b.endpoint
  and a.window_start = b.window_start
  and a.ctid < b.ctid;
create unique index if not exists rate_limits_user_endpoint_window_uidx
  on public.rate_limits (user_id, endpoint, window_start);

alter table public.rate_limits enable row level security;
drop policy if exists "Users can read own rate limits" on public.rate_limits;
drop policy if exists "Users can upsert own rate limits" on public.rate_limits;
drop policy if exists "Users can update own rate limits" on public.rate_limits;
revoke all on table public.rate_limits from anon, authenticated;

create or replace function public.bump_rate_limit(p_endpoint text, p_limit int)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  insert into public.rate_limits (user_id, endpoint, window_start, request_count)
  values (v_uid, p_endpoint, date_trunc('hour', now()), 1)
  on conflict (user_id, endpoint, window_start)
    do update set request_count = public.rate_limits.request_count + 1
  returning request_count into v_count;

  return v_count > p_limit;
end;
$$;

-- ── j. lesson_views: static lessons have no DB lesson row ───────────────────
alter table public.lesson_views alter column lesson_id drop not null;
alter table public.lesson_views add column if not exists topic_key text;

-- ── k. practice_questions natural key (subject, grade, question_text) ───────
-- Re-point answers from duplicate questions to the kept row, then delete dupes.
with ranked as (
  select id,
         first_value(id) over (partition by subject, grade, question_text
                               order by created_at nulls last, id) as keep_id
  from public.practice_questions
)
update public.user_answers ua
set question_id = r.keep_id
from ranked r
where ua.question_id = r.id and r.id <> r.keep_id;

with ranked as (
  select id,
         first_value(id) over (partition by subject, grade, question_text
                               order by created_at nulls last, id) as keep_id
  from public.practice_questions
)
delete from public.practice_questions pq
using ranked r
where pq.id = r.id and r.id <> r.keep_id;

create unique index if not exists practice_questions_natural_key
  on public.practice_questions (subject, grade, question_text);

-- ── Role-change guard: also allow service role / SQL editor (auth.uid() null)
-- (matches prevent_initial_role_escalation in SUPABASE_PHASE3.sql; without this
-- even the dashboard SQL editor cannot promote a user to admin)
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.role is not distinct from old.role then
    return new;
  end if;
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  raise exception 'Role changes are not allowed. Contact your administrator.'
    using errcode = '42501';
end;
$$;

-- ── search_path hardening on earlier SECURITY DEFINER functions ─────────────
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.prevent_role_escalation()',
    'public.prevent_initial_role_escalation()',
    'public.increment_dream_session_count()'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('alter function %s set search_path = public', f);
    end if;
  end loop;
end $$;

-- ── Function privileges: authenticated only ─────────────────────────────────
revoke all on function public.is_admin()                             from public, anon;
revoke all on function public.is_teacher_of(uuid)                    from public, anon;
revoke all on function public.is_parent_of(uuid)                     from public, anon;
revoke all on function public.redeem_link_code(text)                 from public, anon;
revoke all on function public.enroll_student_by_email(uuid, text)    from public, anon;
revoke all on function public.bump_rate_limit(text, int)             from public, anon;

grant execute on function public.is_admin()                          to authenticated;
grant execute on function public.is_teacher_of(uuid)                 to authenticated;
grant execute on function public.is_parent_of(uuid)                  to authenticated;
grant execute on function public.redeem_link_code(text)              to authenticated;
grant execute on function public.enroll_student_by_email(uuid, text) to authenticated;
grant execute on function public.bump_rate_limit(text, int)          to authenticated;
