-- ============================================================================
-- FULL_SETUP_FRESH_PROJECT.sql — Archie Learn complete database setup
--
-- Paste this WHOLE file into Supabase → SQL Editor → Run.
-- * Works on a brand-new, empty Supabase project.
-- * Safe to re-run on an existing project (every step is idempotent).
--
-- Order: 001 initial schema → feedback → SUPABASE_SETUP (002 + claw features
-- + core seed) → SUPABASE_FIX_RLS → SUPABASE_PHASE2 → SUPABASE_PHASE3 →
-- 20261007000000_pilot_fixes → SUPABASE_SEED_MORE → verification query.
--
-- GENERATED from the individual files; if you change one of them, regenerate.
-- ============================================================================


-- ############################################################################
-- PART 1 — 001_initial_schema (idempotent)
-- ############################################################################
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  first_name text,
  grade integer check (grade between 8 and 12),
  primary_subject text,
  role text not null default 'student',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.chat_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now()
);

create table if not exists public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.chat_sessions(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

create index if not exists idx_chat_sessions_user on public.chat_sessions(user_id);
create index if not exists idx_chat_messages_session on public.chat_messages(session_id);
create index if not exists idx_chat_sessions_created on public.chat_sessions(created_at);

alter table public.profiles enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "Users can view own sessions" on public.chat_sessions;
create policy "Users can view own sessions" on public.chat_sessions
  for select using (auth.uid() = user_id);

drop policy if exists "Users can create own sessions" on public.chat_sessions;
create policy "Users can create own sessions" on public.chat_sessions
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can view own messages" on public.chat_messages;
create policy "Users can view own messages" on public.chat_messages
  for select using (auth.uid() = user_id);

drop policy if exists "Users can create own messages" on public.chat_messages;
create policy "Users can create own messages" on public.chat_messages
  for insert with check (auth.uid() = user_id);


-- ############################################################################
-- PART 2 — feedback table (SUPABASE_SETUP enables RLS on it, so it must exist)
-- ############################################################################
create table if not exists public.feedback (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  session_id uuid references public.chat_sessions(id) on delete set null,
  rating integer check (rating between 1 and 5),
  what_worked text,
  what_frustrated text,
  created_at timestamptz not null default now()
);

