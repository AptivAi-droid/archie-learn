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


-- ############################################################################
-- PART 3 — SUPABASE_SETUP.sql (002 schema + claw features + core seed)
-- ############################################################################
-- ─────────────────────────────────────────────────────────────────────────────
-- 002_full_schema.sql
-- Full production schema for Archie Learn
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Extend profiles ──────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists last_name text,
  add column if not exists email text,
  add column if not exists school text,
  add column if not exists subjects text[] default '{}',
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
    check (role in ('student', 'teacher', 'parent', 'admin'));

-- ── Lessons ──────────────────────────────────────────────────────────────────
create table if not exists public.lessons (
  id uuid default gen_random_uuid() primary key,
  subject text not null,
  grade integer not null check (grade between 8 and 12),
  topic_name text not null,
  caps_reference text,
  content jsonb not null default '[]',
  created_at timestamptz default now()
);

create index if not exists idx_lessons_subject_grade on public.lessons(subject, grade);

-- ── Practice questions ────────────────────────────────────────────────────────
create table if not exists public.practice_questions (
  id uuid default gen_random_uuid() primary key,
  lesson_id uuid references public.lessons(id) on delete cascade,
  subject text not null,
  grade integer not null check (grade between 8 and 12),
  question_text text not null,
  model_answer text not null,
  marks integer not null default 4 check (marks > 0),
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  created_at timestamptz default now()
);

create index if not exists idx_pq_subject_grade on public.practice_questions(subject, grade);

-- ── User answers ──────────────────────────────────────────────────────────────
create table if not exists public.user_answers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  question_id uuid references public.practice_questions(id) on delete cascade not null,
  answer_text text not null,
  ai_score integer,
  ai_feedback text,
  max_marks integer not null default 4,
  answered_at timestamptz default now()
);

create index if not exists idx_user_answers_user on public.user_answers(user_id);
create index if not exists idx_user_answers_question on public.user_answers(question_id);

-- ── Parent–student links ──────────────────────────────────────────────────────
create table if not exists public.parent_student_links (
  id uuid default gen_random_uuid() primary key,
  parent_id uuid references public.profiles(id) on delete cascade not null,
  student_id uuid references public.profiles(id) on delete cascade not null,
  confirmed boolean not null default false,
  created_at timestamptz default now(),
  unique (parent_id, student_id)
);

-- ── Link codes (student generates, parent enters) ─────────────────────────────
create table if not exists public.link_codes (
  code char(6) primary key,
  student_id uuid references public.profiles(id) on delete cascade not null,
  expires_at timestamptz not null default (now() + interval '48 hours'),
  used boolean not null default false
);

-- ── Teacher classes ───────────────────────────────────────────────────────────
create table if not exists public.teacher_classes (
  id uuid default gen_random_uuid() primary key,
  teacher_id uuid references public.profiles(id) on delete cascade not null,
  class_name text not null,
  grade integer check (grade between 8 and 12),
  subject text,
  created_at timestamptz default now()
);

create index if not exists idx_teacher_classes_teacher on public.teacher_classes(teacher_id);

-- ── Class enrollments ─────────────────────────────────────────────────────────
create table if not exists public.class_enrollments (
  id uuid default gen_random_uuid() primary key,
  class_id uuid references public.teacher_classes(id) on delete cascade not null,
  student_id uuid references public.profiles(id) on delete cascade not null,
  enrolled_at timestamptz default now(),
  unique (class_id, student_id)
);

create index if not exists idx_enrollments_class on public.class_enrollments(class_id);
create index if not exists idx_enrollments_student on public.class_enrollments(student_id);

-- ── Rate limits ───────────────────────────────────────────────────────────────
create table if not exists public.rate_limits (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  endpoint text not null,
  window_start timestamptz not null default now(),
  request_count integer not null default 1,
  unique (user_id, endpoint, window_start)
);

create index if not exists idx_rate_limits_user_endpoint on public.rate_limits(user_id, endpoint, window_start);

-- ── Lesson access log (tracks topics covered per student) ─────────────────────
create table if not exists public.lesson_views (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  lesson_id uuid references public.lessons(id) on delete cascade not null,
  viewed_at timestamptz default now()
);

create index if not exists idx_lesson_views_user on public.lesson_views(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.lessons enable row level security;
alter table public.practice_questions enable row level security;
alter table public.user_answers enable row level security;
alter table public.parent_student_links enable row level security;
alter table public.link_codes enable row level security;
alter table public.teacher_classes enable row level security;
alter table public.class_enrollments enable row level security;
alter table public.rate_limits enable row level security;
alter table public.lesson_views enable row level security;

-- Fix feedback RLS (was missing)
alter table public.feedback enable row level security;

drop policy if exists "Users can insert own feedback" on public.feedback;

create policy "Users can insert own feedback" on public.feedback for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can view own feedback" on public.feedback;

create policy "Users can view own feedback" on public.feedback for select
  using (auth.uid() = user_id);

-- Lessons: all authenticated users can read
drop policy if exists "Authenticated users can read lessons" on public.lessons;
create policy "Authenticated users can read lessons" on public.lessons for select
  using (auth.role() = 'authenticated');

-- Practice questions: all authenticated users can read
drop policy if exists "Authenticated users can read practice questions" on public.practice_questions;
create policy "Authenticated users can read practice questions" on public.practice_questions for select
  using (auth.role() = 'authenticated');

-- User answers: own only
drop policy if exists "Users can insert own answers" on public.user_answers;
create policy "Users can insert own answers" on public.user_answers for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can view own answers" on public.user_answers;

create policy "Users can view own answers" on public.user_answers for select
  using (auth.uid() = user_id);

-- Teachers can view answers for students in their classes
drop policy if exists "Teachers can view class student answers" on public.user_answers;
create policy "Teachers can view class student answers" on public.user_answers for select
  using (
    exists (
      select 1 from public.class_enrollments ce
      join public.teacher_classes tc on tc.id = ce.class_id
      where ce.student_id = user_answers.user_id
        and tc.teacher_id = auth.uid()
    )
  );

-- Parent–student links
drop policy if exists "Parents can view own links" on public.parent_student_links;
create policy "Parents can view own links" on public.parent_student_links for select
  using (auth.uid() = parent_id);

drop policy if exists "Parents can insert own links" on public.parent_student_links;

create policy "Parents can insert own links" on public.parent_student_links for insert
  with check (auth.uid() = parent_id);

-- Link codes: students can manage their own codes
drop policy if exists "Students can create link codes" on public.link_codes;
create policy "Students can create link codes" on public.link_codes for insert
  with check (auth.uid() = student_id);

drop policy if exists "Students can view own link codes" on public.link_codes;

create policy "Students can view own link codes" on public.link_codes for select
  using (auth.uid() = student_id);

-- Parents can look up a code (needed to redeem it)
drop policy if exists "Anyone authenticated can read link codes to redeem" on public.link_codes;
create policy "Anyone authenticated can read link codes to redeem" on public.link_codes for select
  using (auth.role() = 'authenticated');

drop policy if exists "Parents can mark link codes as used" on public.link_codes;

create policy "Parents can mark link codes as used" on public.link_codes for update
  using (auth.role() = 'authenticated');

-- Teacher classes
drop policy if exists "Teachers can manage own classes" on public.teacher_classes;
create policy "Teachers can manage own classes" on public.teacher_classes for all
  using (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);

-- Students/parents can see classes they're enrolled in
drop policy if exists "Students can see their classes" on public.teacher_classes;
create policy "Students can see their classes" on public.teacher_classes for select
  using (
    exists (
      select 1 from public.class_enrollments
      where class_id = teacher_classes.id
        and student_id = auth.uid()
    )
  );

-- Class enrollments
drop policy if exists "Teachers can manage enrollments for their classes" on public.class_enrollments;
create policy "Teachers can manage enrollments for their classes" on public.class_enrollments for all
  using (
    exists (
      select 1 from public.teacher_classes
      where id = class_enrollments.class_id
        and teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.teacher_classes
      where id = class_enrollments.class_id
        and teacher_id = auth.uid()
    )
  );

drop policy if exists "Students can view own enrollments" on public.class_enrollments;

create policy "Students can view own enrollments" on public.class_enrollments for select
  using (auth.uid() = student_id);

-- Rate limits: users manage own
drop policy if exists "Users can read own rate limits" on public.rate_limits;
create policy "Users can read own rate limits" on public.rate_limits for select
  using (auth.uid() = user_id);

drop policy if exists "Users can upsert own rate limits" on public.rate_limits;

create policy "Users can upsert own rate limits" on public.rate_limits for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own rate limits" on public.rate_limits;

create policy "Users can update own rate limits" on public.rate_limits for update
  using (auth.uid() = user_id);

-- Lesson views: own only, teachers can see class students
drop policy if exists "Users can log own lesson views" on public.lesson_views;
create policy "Users can log own lesson views" on public.lesson_views for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can see own lesson views" on public.lesson_views;

create policy "Users can see own lesson views" on public.lesson_views for select
  using (auth.uid() = user_id);

drop policy if exists "Teachers can see class students lesson views" on public.lesson_views;

create policy "Teachers can see class students lesson views" on public.lesson_views for select
  using (
    exists (
      select 1 from public.class_enrollments ce
      join public.teacher_classes tc on tc.id = ce.class_id
      where ce.student_id = lesson_views.user_id
        and tc.teacher_id = auth.uid()
    )
  );

-- Parents can view linked student's lesson views
drop policy if exists "Parents can view linked student lesson views" on public.lesson_views;
create policy "Parents can view linked student lesson views" on public.lesson_views for select
  using (
    exists (
      select 1 from public.parent_student_links
      where parent_id = auth.uid()
        and student_id = lesson_views.user_id
        and confirmed = true
    )
  );

-- Parents can view linked student's chat sessions
drop policy if exists "Parents can view linked student sessions" on public.chat_sessions;
create policy "Parents can view linked student sessions" on public.chat_sessions for select
  using (
    exists (
      select 1 from public.parent_student_links
      where parent_id = auth.uid()
        and student_id = chat_sessions.user_id
        and confirmed = true
    )
  );

-- Parents can view linked student profiles
drop policy if exists "Parents can view linked student profiles" on public.profiles;
create policy "Parents can view linked student profiles" on public.profiles for select
  using (
    exists (
      select 1 from public.parent_student_links
      where parent_id = auth.uid()
        and student_id = profiles.id
        and confirmed = true
    )
  );

-- Teachers can view enrolled student profiles
drop policy if exists "Teachers can view enrolled student profiles" on public.profiles;
create policy "Teachers can view enrolled student profiles" on public.profiles for select
  using (
    exists (
      select 1 from public.class_enrollments ce
      join public.teacher_classes tc on tc.id = ce.class_id
      where ce.student_id = profiles.id
        and tc.teacher_id = auth.uid()
    )
  );

-- Teachers can view enrolled student sessions
drop policy if exists "Teachers can view enrolled student sessions" on public.chat_sessions;
create policy "Teachers can view enrolled student sessions" on public.chat_sessions for select
  using (
    exists (
      select 1 from public.class_enrollments ce
      join public.teacher_classes tc on tc.id = ce.class_id
      where ce.student_id = chat_sessions.user_id
        and tc.teacher_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED: Practice questions per subject (Grades 9, 10, 11 samples)
-- ─────────────────────────────────────────────────────────────────────────────

-- Natural key so re-running the seed never duplicates questions.
-- De-duplicate first (answers are re-pointed to the kept row), then enforce.
with ranked as (
  select id, first_value(id) over (partition by subject, grade, question_text
                                   order by created_at nulls last, id) as keep_id
  from public.practice_questions
)
update public.user_answers ua set question_id = r.keep_id
from ranked r where ua.question_id = r.id and r.id <> r.keep_id;

with ranked as (
  select id, first_value(id) over (partition by subject, grade, question_text
                                   order by created_at nulls last, id) as keep_id
  from public.practice_questions
)
delete from public.practice_questions pq
using ranked r where pq.id = r.id and r.id <> r.keep_id;

create unique index if not exists practice_questions_natural_key
  on public.practice_questions (subject, grade, question_text);

insert into public.practice_questions (subject, grade, question_text, model_answer, marks, difficulty) values

-- Mathematics Grade 9
('Mathematics', 9, 'Simplify: 3x + 5x − 2x', '6x', 2, 'easy'),
('Mathematics', 9, 'Solve for x: 2x + 7 = 15', 'x = 4', 3, 'easy'),
('Mathematics', 9, 'Calculate the area of a rectangle with length 8 cm and width 5 cm.', 'Area = length × width = 8 × 5 = 40 cm²', 4, 'easy'),
('Mathematics', 9, 'Expand and simplify: (x + 3)(x − 2)', 'x² − 2x + 3x − 6 = x² + x − 6', 4, 'medium'),
('Mathematics', 9, 'A store sells a jacket for R450. During a sale it is discounted by 20%. What is the sale price?', 'Discount = 20% × 450 = R90. Sale price = 450 − 90 = R360', 4, 'medium'),

-- Mathematics Grade 10
('Mathematics', 10, 'Factorise: x² − 9', '(x − 3)(x + 3) — difference of squares', 3, 'easy'),
('Mathematics', 10, 'Solve for x: x² − 5x + 6 = 0', '(x − 2)(x − 3) = 0, so x = 2 or x = 3', 5, 'medium'),
('Mathematics', 10, 'A right-angled triangle has legs of length 5 cm and 12 cm. Find the hypotenuse.', 'h² = 5² + 12² = 25 + 144 = 169, so h = 13 cm', 4, 'medium'),
('Mathematics', 10, 'Write the equation of the line with gradient 2 passing through (0, −3).', 'y = 2x − 3', 3, 'easy'),
('Mathematics', 10, 'Simplify: (2x³)(3x²)', '6x⁵', 3, 'easy'),

-- Mathematics Grade 11
('Mathematics', 11, 'Determine the discriminant of 2x² − 3x + 1 = 0 and describe the nature of the roots.', 'Δ = b² − 4ac = 9 − 8 = 1 > 0, so two distinct real roots', 5, 'medium'),
('Mathematics', 11, 'Solve for x: log₂(x) = 5', 'x = 2⁵ = 32', 4, 'medium'),
('Mathematics', 11, 'Find the derivative of f(x) = 3x² − 4x + 7 using first principles or rules.', 'f''(x) = 6x − 4', 5, 'hard'),

-- Mathematics Grade 12
('Mathematics', 12, 'Evaluate: ∫(4x³ − 2x) dx', '∫(4x³ − 2x) dx = x⁴ − x² + C', 5, 'hard'),
('Mathematics', 12, 'The first term of a geometric sequence is 3 and the common ratio is 2. Find the sum of the first 6 terms.', 'S₆ = 3(2⁶ − 1)/(2 − 1) = 3 × 63 = 189', 5, 'medium'),

-- Mathematics Grade 8
('Mathematics', 8, 'Round 3 476 to the nearest hundred.', '3 500', 2, 'easy'),
('Mathematics', 8, 'Calculate: 15 + (−8)', '7', 2, 'easy'),
('Mathematics', 8, 'What is 25% of 200?', '50', 3, 'easy'),
('Mathematics', 8, 'Simplify the ratio 12 : 18', '2 : 3', 3, 'easy'),

-- Physical Sciences Grade 10
('Physical Sciences', 10, 'State Newton''s Second Law of Motion.', 'The net force acting on an object is equal to the product of its mass and acceleration: F_net = ma', 4, 'medium'),
('Physical Sciences', 10, 'A car of mass 1 200 kg accelerates at 3 m/s². Calculate the net force acting on it.', 'F = ma = 1 200 × 3 = 3 600 N', 4, 'easy'),
('Physical Sciences', 10, 'What is the difference between a mixture and a compound?', 'A mixture contains two or more substances not chemically combined (can be separated physically). A compound contains elements chemically combined in fixed ratios (requires chemical change to separate).', 5, 'medium'),
('Physical Sciences', 10, 'Calculate the kinetic energy of a 5 kg ball moving at 10 m/s.', 'KE = ½mv² = ½ × 5 × 100 = 250 J', 4, 'medium'),

-- Physical Sciences Grade 11
('Physical Sciences', 11, 'State the Aufbau principle.', 'Electrons fill the lowest available energy orbitals first, before occupying higher energy orbitals.', 4, 'medium'),
('Physical Sciences', 11, 'An object is dropped from rest and falls freely for 3 s. Calculate the distance fallen. (g = 9,8 m/s²)', 'd = ½gt² = ½ × 9,8 × 9 = 44,1 m', 5, 'medium'),
('Physical Sciences', 11, 'Explain what happens to the rate of a chemical reaction when temperature is increased.', 'Increasing temperature gives reactant particles more kinetic energy, so they collide more frequently and with more energy, increasing the rate of reaction.', 5, 'medium'),

-- Physical Sciences Grade 12
('Physical Sciences', 12, 'State Faraday''s Law of electromagnetic induction.', 'The magnitude of the induced EMF is directly proportional to the rate of change of magnetic flux linkage through the circuit.', 5, 'hard'),
('Physical Sciences', 12, 'Explain the photoelectric effect.', 'When light of sufficient frequency strikes a metal surface, electrons are emitted. The energy of the photon must be greater than the work function of the metal. E = hf where h is Planck''s constant.', 6, 'hard'),

-- Life Sciences Grade 10
('Life Sciences', 10, 'Name the four organic molecules essential to life.', 'Carbohydrates, proteins, lipids (fats), and nucleic acids (DNA and RNA).', 4, 'easy'),
('Life Sciences', 10, 'Explain the difference between mitosis and meiosis.', 'Mitosis produces two genetically identical diploid daughter cells (for growth and repair). Meiosis produces four genetically different haploid cells (for sexual reproduction).', 6, 'medium'),
('Life Sciences', 10, 'What is the role of chlorophyll in photosynthesis?', 'Chlorophyll absorbs light energy (mainly red and blue wavelengths) and converts it to chemical energy used to produce glucose from CO₂ and water.', 4, 'medium'),

-- Life Sciences Grade 11
('Life Sciences', 11, 'Describe the structure of DNA.', 'DNA is a double helix made of two antiparallel strands. Each strand is a polymer of nucleotides, each consisting of a deoxyribose sugar, phosphate group, and a nitrogenous base (A, T, G, or C). A pairs with T and G pairs with C.', 6, 'medium'),
('Life Sciences', 11, 'What is natural selection? Give an example from the South African context.', 'Natural selection is the process where organisms with favourable traits survive and reproduce more successfully, passing traits to offspring. Example: antibiotic-resistant TB bacteria are selected for in SA because susceptible strains are killed by medication.', 6, 'hard'),

-- Life Sciences Grade 12
('Life Sciences', 12, 'Explain how a nerve impulse (action potential) is transmitted along a neuron.', 'A stimulus causes sodium channels to open, Na⁺ rushes in making the inside positive (depolarisation). Then K⁺ flows out (repolarisation). The sodium-potassium pump restores the resting potential. This wave of depolarisation travels along the axon.', 8, 'hard'),

-- English Home Language Grade 10
('English Home Language', 10, 'Identify and explain ONE literary device used in this sentence: "The wind howled through the empty streets."', 'Personification — the wind is given a human quality (howling) to create atmosphere and convey the eeriness of the empty streets.', 4, 'medium'),
('English Home Language', 10, 'What is a topic sentence? Write an example.', 'A topic sentence states the main idea of a paragraph. Example: "Social media has significantly changed how South African teenagers communicate."', 4, 'easy'),
('English Home Language', 10, 'Explain the difference between a simile and a metaphor. Give one example of each.', 'A simile compares using "like" or "as": "He runs like the wind." A metaphor states one thing IS another: "He is a cheetah on the field."', 4, 'easy'),

-- English Home Language Grade 11
('English Home Language', 11, 'What is dramatic irony? Give an example from any text you have studied.', 'Dramatic irony occurs when the audience knows something that the characters do not. Example: In Romeo and Juliet, the audience knows Juliet is not dead but Romeo does not, making his suicide more tragic.', 6, 'medium'),
('English Home Language', 11, 'Analyse how an author creates mood in the opening paragraph of a novel. Use specific techniques.', 'Mood is created through word choice (diction), imagery, sentence structure and figurative language. Dark, heavy diction ("decaying", "silence") and slow, long sentences create a sombre, oppressive mood. Short sentences can create tension and urgency.', 6, 'hard'),

-- English Home Language Grade 12
('English Home Language', 12, 'Discuss the theme of power and its abuse in a prescribed novel or drama you have studied, with evidence from the text.', 'A full answer would identify a specific work, state the theme clearly, provide at least two textual examples with quotes, explain the author''s message, and link to broader social context. Marks awarded for: identification of theme (2), evidence (2), analysis (2), language (2).', 8, 'hard'),

-- History Grade 10
('History', 10, 'What was the Berlin Conference of 1884–1885 and why was it significant for Africa?', 'European powers met in Berlin to partition Africa among themselves without African representation. It formalised the "Scramble for Africa" and led to arbitrary borders that divided ethnic groups and fuelled future conflicts.', 6, 'medium'),
('History', 10, 'Define imperialism and give one example of its effects in South Africa.', 'Imperialism is the policy of extending a nation''s power through colonisation or economic domination. In South Africa, British imperialism led to the Anglo-Boer War (1899–1902) as Britain sought control of gold and diamond resources.', 5, 'medium'),

-- History Grade 11
('History', 11, 'Explain the causes of World War I using the MAIN acronym.', 'M – Militarism (arms race between powers). A – Alliance system (Triple Alliance vs Triple Entente). I – Imperialism (competition for colonies). N – Nationalism (desire for self-rule, Pan-Slavism, tensions in the Balkans). The assassination of Archduke Franz Ferdinand in 1914 was the trigger.', 8, 'hard'),
('History', 11, 'What was apartheid and when was it officially introduced in South Africa?', 'Apartheid was a system of institutionalised racial segregation and discrimination enforced by the National Party government from 1948. Laws classified people by race and restricted where they could live, work, study and travel.', 5, 'medium'),

-- History Grade 12
('History', 12, 'Assess the role of the ANC Youth League in the anti-apartheid struggle from 1944 to 1960.', 'The ANCYL, founded in 1944 by Nelson Mandela, Walter Sisulu and others, pushed the ANC toward mass action. They authored the 1949 Programme of Action calling for strikes, civil disobedience and boycotts. They energised the 1952 Defiance Campaign and shaped the 1955 Freedom Charter process. By 1960, state repression (Sharpeville massacre, banning of ANC) forced the movement underground.', 8, 'hard'),

-- History Grade 8
('History', 8, 'What is a primary source? Give one example.', 'A primary source is original evidence from the time being studied. Examples include diaries, letters, photographs, government documents, and eyewitness accounts.', 4, 'easy'),
('History', 8, 'Explain one reason why early humans moved from place to place (nomadic lifestyle).', 'Early humans were hunter-gatherers and had to follow animal migrations and seasonal plant growth for food. Once resources in an area were depleted, they moved on.', 4, 'easy')

on conflict (subject, grade, question_text) do nothing;
-- ============================================================
-- Migration: Claude Code Architecture Features
-- Archie Learn — claw-code integration
-- Date: 12 April 2026
-- Features: BUDDY, AutoDream, KAIROS, Coordinator, ULTRAPLAN
-- ============================================================

-- ── 1. BUDDY — Companion system ─────────────────────────────
CREATE TABLE IF NOT EXISTS buddy_companions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buddy_data    JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_buddy_companions_user_id ON buddy_companions(user_id);

ALTER TABLE buddy_companions ENABLE ROW LEVEL SECURITY;
drop policy if exists "Users can manage own buddy" on buddy_companions;
create policy "Users can manage own buddy" on buddy_companions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 2. LEARNER MEMORY — AutoDream consolidation ─────────────
CREATE TABLE IF NOT EXISTS learner_memory (
  id                          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_text                 TEXT,
  session_count_since_dream   INTEGER DEFAULT 0,
  total_dreams                INTEGER DEFAULT 0,
  last_consolidated_at        TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_learner_memory_user_id ON learner_memory(user_id);

ALTER TABLE learner_memory ENABLE ROW LEVEL SECURITY;
-- Service role only — backend writes, frontend reads own row
drop policy if exists "Users can read own memory" on learner_memory;
create policy "Users can read own memory" on learner_memory FOR SELECT
  USING (auth.uid() = user_id);
drop policy if exists "Service role can write memory" on learner_memory;
create policy "Service role can write memory" on learner_memory FOR ALL
  USING (true)
  WITH CHECK (true);

-- ── 3. CURRICULA — Coordinator-generated learning paths ─────
CREATE TABLE IF NOT EXISTS curricula (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  curriculum_data   JSONB NOT NULL DEFAULT '{}',
  active            BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_curricula_user_id ON curricula(user_id);

ALTER TABLE curricula ENABLE ROW LEVEL SECURITY;
drop policy if exists "Users can read own curriculum" on curricula;
create policy "Users can read own curriculum" on curricula FOR SELECT
  USING (auth.uid() = user_id);
drop policy if exists "Service role can write curriculum" on curricula;
create policy "Service role can write curriculum" on curricula FOR ALL
  USING (true)
  WITH CHECK (true);

-- ── 4. ULTRAPLANS — Deep planning outputs ───────────────────
CREATE TABLE IF NOT EXISTS ultraplans (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type   TEXT NOT NULL CHECK (plan_type IN ('exam_prep_12week', 'subject_mastery', 'recovery_plan')),
  plan_text   TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ultraplans_user_id ON ultraplans(user_id);

ALTER TABLE ultraplans ENABLE ROW LEVEL SECURITY;
drop policy if exists "Users can read own ultraplans" on ultraplans;
create policy "Users can read own ultraplans" on ultraplans FOR SELECT
  USING (auth.uid() = user_id);
drop policy if exists "Service role can insert ultraplans" on ultraplans;
create policy "Service role can insert ultraplans" on ultraplans FOR INSERT
  WITH CHECK (true);

-- ── 5. SESSION COUNT TRIGGER — increments AutoDream counter ─
-- Automatically increments session_count_since_dream on each new chat_session
CREATE OR REPLACE FUNCTION increment_dream_session_count()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO learner_memory (user_id, session_count_since_dream, created_at, updated_at)
  VALUES (NEW.user_id, 1, NOW(), NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET session_count_since_dream = learner_memory.session_count_since_dream + 1,
        updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_chat_session_created ON chat_sessions;
CREATE TRIGGER on_chat_session_created
  AFTER INSERT ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION increment_dream_session_count();

-- ── 6. Updated_at trigger helper ────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_buddy_updated_at ON buddy_companions;
CREATE TRIGGER set_buddy_updated_at
  BEFORE UPDATE ON buddy_companions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_memory_updated_at ON learner_memory;
CREATE TRIGGER set_memory_updated_at
  BEFORE UPDATE ON learner_memory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_curricula_updated_at ON curricula;
CREATE TRIGGER set_curricula_updated_at
  BEFORE UPDATE ON curricula
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ############################################################################
-- PART 4 — SUPABASE_FIX_RLS.sql
-- ############################################################################
-- ============================================================
-- RLS Recursion Fix — paste this entire block into the SQL Editor and Run
-- ============================================================
-- Drops the recursive cross-table policies that caused
-- "infinite recursion detected in policy" on teacher_classes,
-- class_enrollments, user_answers, lesson_views, and replaces
-- them with non-recursive ones via SECURITY DEFINER helper functions.

-- 1) Drop the problematic policies
DROP POLICY IF EXISTS "Students can see their classes" ON public.teacher_classes;
DROP POLICY IF EXISTS "Students see enrolled classes" ON public.teacher_classes;
DROP POLICY IF EXISTS "Teachers can manage enrollments for their classes" ON public.class_enrollments;
DROP POLICY IF EXISTS "Teachers can manage enrollments in own classes" ON public.class_enrollments;
DROP POLICY IF EXISTS "Teachers manage enrollments in own classes" ON public.class_enrollments;
DROP POLICY IF EXISTS "Teachers can view class student answers" ON public.user_answers;
DROP POLICY IF EXISTS "Teachers can see class students lesson views" ON public.lesson_views;
DROP POLICY IF EXISTS "Teachers can view enrolled student profiles" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can view enrolled student sessions" ON public.chat_sessions;

-- 2) Helper functions that bypass RLS via SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_teacher_of_class(c_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.teacher_classes
    WHERE id = c_id AND teacher_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_student_in_class(c_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.class_enrollments
    WHERE class_id = c_id AND student_id = auth.uid()
  );
$$;

-- 3) Non-recursive policies using the functions
CREATE POLICY "Teachers manage enrollments in own classes"
  ON public.class_enrollments FOR ALL
  USING (public.is_teacher_of_class(class_id))
  WITH CHECK (public.is_teacher_of_class(class_id));

CREATE POLICY "Students see enrolled classes"
  ON public.teacher_classes FOR SELECT
  USING (public.is_student_in_class(id));


-- ############################################################################
-- PART 5 — SUPABASE_PHASE2.sql
-- ############################################################################
-- ============================================================
-- Phase 2: Role-escalation guard + signup_applications table + DOB
-- Safe to re-run (uses DROP IF EXISTS and IF NOT EXISTS).
-- ============================================================

-- ── 1. Add DOB column to profiles ──────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dob date;

-- ── 2. Role-escalation guard ───────────────────────────────
-- Block anyone except admins from changing the role column
-- of their own profile. Without this, a student could call
-- the REST API and set their own role to 'teacher' or 'admin'.

CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_role text;
BEGIN
  -- Allow if role hasn't actually changed
  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;

  -- Allow if the change is being made by an admin
  SELECT role INTO caller_role
    FROM public.profiles
    WHERE id = auth.uid();

  IF caller_role = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Otherwise reject the change
  RAISE EXCEPTION 'Role changes are not allowed. Contact your administrator.'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_role_escalation_trigger ON public.profiles;
CREATE TRIGGER prevent_role_escalation_trigger
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();

-- ── 3. signup_applications table ───────────────────────────
CREATE TABLE IF NOT EXISTS public.signup_applications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  requested_role text NOT NULL CHECK (requested_role IN ('teacher', 'parent')),
  dob date NOT NULL,
  application_data jsonb NOT NULL DEFAULT '{}',
  ai_decision text CHECK (ai_decision IN ('APPROVED', 'NEEDS_REVIEW', 'REJECTED')),
  ai_confidence numeric(3, 2),
  ai_reasoning text,
  ai_red_flags jsonb DEFAULT '[]',
  admin_decision text CHECK (admin_decision IN ('APPROVED', 'REJECTED')),
  admin_notes text,
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  created_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address inet,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signup_applications_email
  ON public.signup_applications(email);
CREATE INDEX IF NOT EXISTS idx_signup_applications_status
  ON public.signup_applications(ai_decision, admin_decision);
CREATE INDEX IF NOT EXISTS idx_signup_applications_created_at
  ON public.signup_applications(created_at DESC);

-- RLS: only admins can read; service role (edge function) writes
ALTER TABLE public.signup_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read all applications" ON public.signup_applications;
CREATE POLICY "Admins read all applications"
  ON public.signup_applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update applications" ON public.signup_applications;
CREATE POLICY "Admins can update applications"
  ON public.signup_applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );


-- ############################################################################
-- PART 6 — SUPABASE_PHASE3.sql
-- ############################################################################
-- ============================================================
-- Phase 3: Close the INSERT-time role-escalation gap
-- Self-signups (where auth.uid() = NEW.id) may only have role=student.
-- Service role and admins can set any role (for AI agent + admin invites).
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_initial_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_role text;
BEGIN
  -- Default role to student if NULL
  IF NEW.role IS NULL THEN
    NEW.role := 'student';
    RETURN NEW;
  END IF;

  -- 'student' is always allowed
  IF NEW.role = 'student' THEN
    RETURN NEW;
  END IF;

  -- Service-role calls (edge functions, admin SQL) have NULL auth.uid()
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Caller must be an admin to set role != 'student'
  SELECT role INTO caller_role
    FROM public.profiles
    WHERE id = auth.uid();

  IF caller_role = 'admin' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Self-signups can only have role=student. Adult roles require admin or AI approval.'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_initial_role_escalation_trigger ON public.profiles;
CREATE TRIGGER prevent_initial_role_escalation_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_initial_role_escalation();


-- ############################################################################
-- PART 7 — supabase/migrations/20261007000000_pilot_fixes.sql
-- ############################################################################
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


-- ############################################################################
-- PART 8 — SUPABASE_SEED_MORE.sql
-- ############################################################################
-- ============================================================
-- Additional practice questions — fills Grade 8/9 gaps + adds the
-- 4 new CAPS subjects (Mathematical Literacy, Geography, Accounting,
-- Business Studies). Safe to re-run (ON CONFLICT DO NOTHING).
-- ============================================================

-- Natural key so re-running the seed never duplicates questions.
-- De-duplicate first (answers are re-pointed to the kept row), then enforce.
with ranked as (
  select id, first_value(id) over (partition by subject, grade, question_text
                                   order by created_at nulls last, id) as keep_id
  from public.practice_questions
)
update public.user_answers ua set question_id = r.keep_id
from ranked r where ua.question_id = r.id and r.id <> r.keep_id;

with ranked as (
  select id, first_value(id) over (partition by subject, grade, question_text
                                   order by created_at nulls last, id) as keep_id
  from public.practice_questions
)
delete from public.practice_questions pq
using ranked r where pq.id = r.id and r.id <> r.keep_id;

create unique index if not exists practice_questions_natural_key
  on public.practice_questions (subject, grade, question_text);

INSERT INTO public.practice_questions (subject, grade, question_text, model_answer, marks, difficulty) VALUES

-- ── English Home Language Grade 8 & 9 ──
('English Home Language', 8, 'What is a noun? Give two examples.', 'A noun is a word that names a person, place, thing or idea. Examples: "teacher" (person), "school" (place).', 3, 'easy'),
('English Home Language', 8, 'Underline the verb in this sentence: "The dog chased the cat."', 'chased', 2, 'easy'),
('English Home Language', 8, 'What is the difference between a fact and an opinion?', 'A fact can be proven true with evidence. An opinion is what someone thinks or feels — it cannot be proven.', 4, 'medium'),
('English Home Language', 9, 'Identify the figure of speech: "Her smile was as bright as the sun."', 'Simile — it compares two things using "as".', 3, 'easy'),
('English Home Language', 9, 'What is the difference between a main clause and a subordinate clause?', 'A main clause can stand alone as a complete sentence. A subordinate clause depends on a main clause and cannot stand alone.', 5, 'medium'),
('English Home Language', 9, 'Rewrite this sentence in the passive voice: "The learners completed the project."', 'The project was completed by the learners.', 3, 'medium'),

-- ── Life Sciences Grade 8 & 9 ──
('Life Sciences', 8, 'Name the five senses and the organ associated with each.', 'Sight (eyes), hearing (ears), smell (nose), taste (tongue), touch (skin).', 5, 'easy'),
('Life Sciences', 8, 'What is a producer in a food chain? Give one example.', 'A producer is an organism that makes its own food using sunlight (e.g. green plants, grass).', 3, 'easy'),
('Life Sciences', 8, 'List the three main parts of the human respiratory system.', 'Nose/mouth, trachea (windpipe), lungs (with bronchi and alveoli).', 4, 'medium'),
('Life Sciences', 9, 'What is the function of red blood cells?', 'Red blood cells transport oxygen from the lungs to the rest of the body, and carry carbon dioxide back to the lungs.', 4, 'medium'),
('Life Sciences', 9, 'Define photosynthesis and write its word equation.', 'Photosynthesis is the process plants use to make their own food using sunlight. Word equation: carbon dioxide + water → (sunlight + chlorophyll) → glucose + oxygen.', 5, 'medium'),
('Life Sciences', 9, 'Explain the difference between an organ and a tissue.', 'A tissue is a group of similar cells doing the same job (e.g. muscle tissue). An organ is made of different tissues working together (e.g. the heart).', 4, 'medium'),

-- ── Physical Sciences Grade 8 & 9 ──
('Physical Sciences', 8, 'Give an example of a physical change and a chemical change.', 'Physical change: ice melting into water (no new substance formed). Chemical change: wood burning to ash (new substance formed).', 4, 'easy'),
('Physical Sciences', 8, 'What are the three states of matter? Give one example of each.', 'Solid (ice), liquid (water), gas (steam/water vapour).', 3, 'easy'),
('Physical Sciences', 8, 'Name three forms of energy and an example of each.', 'Kinetic (a moving car), potential (water in a dam), heat (a stove element).', 4, 'medium'),
('Physical Sciences', 9, 'What is the unit of force, and what is one Newton?', 'The unit of force is the Newton (N). One Newton is the force needed to accelerate a 1 kg mass at 1 m/s².', 4, 'medium'),
('Physical Sciences', 9, 'Describe the structure of an atom in simple terms.', 'An atom has a nucleus in the middle made of protons (positive) and neutrons (no charge), with electrons (negative) orbiting around it.', 5, 'medium'),
('Physical Sciences', 9, 'A toy car has a mass of 0,5 kg and accelerates at 4 m/s². What is the net force on it?', 'F = ma = 0,5 × 4 = 2 N', 4, 'medium'),

-- ── History Grade 9 ──
('History', 9, 'What was the Great Trek and why did the Voortrekkers leave the Cape Colony?', 'The Great Trek (1830s–40s) was the migration of Dutch-speaking farmers (Voortrekkers) from the Cape into the interior of southern Africa. They left due to dissatisfaction with British rule, including the abolition of slavery, language policies, and border tensions.', 6, 'medium'),
('History', 9, 'Name two impacts of the Mineral Revolution on South Africa.', 'The discovery of diamonds (1867, Kimberley) and gold (1886, Witwatersrand) transformed SA: it brought industrialisation, mass migration of labour from rural areas, and laid the foundation for racially-segregated labour systems that fed into apartheid.', 6, 'medium'),

-- ── Mathematical Literacy (Grades 10, 11, 12) ──
('Mathematical Literacy', 10, 'A taxi charges R10 plus R2 per km. How much does a 15 km trip cost?', 'Cost = 10 + (2 × 15) = 10 + 30 = R40', 3, 'easy'),
('Mathematical Literacy', 10, 'Convert 75% to a decimal and to a fraction in simplest form.', '75% = 0,75 = 75/100 = 3/4', 3, 'easy'),
('Mathematical Literacy', 10, 'A shop offers 15% off a R250 shirt. What is the sale price?', 'Discount = 15% × 250 = R37,50. Sale price = 250 − 37,50 = R212,50.', 4, 'easy'),
('Mathematical Literacy', 11, 'A car uses 8 litres of petrol per 100 km. At R23/litre, how much does a 250 km trip cost?', 'Litres used = (8/100) × 250 = 20 L. Cost = 20 × 23 = R460.', 5, 'medium'),
('Mathematical Literacy', 11, 'Calculate VAT (15%) on a R1 200 purchase. What is the total?', 'VAT = 15% × 1 200 = R180. Total = 1 200 + 180 = R1 380.', 4, 'easy'),
('Mathematical Literacy', 12, 'A R5 000 investment earns simple interest at 8% per year for 3 years. Calculate the interest and final value.', 'Interest = P × r × t = 5 000 × 0,08 × 3 = R1 200. Final value = 5 000 + 1 200 = R6 200.', 5, 'medium'),
('Mathematical Literacy', 12, 'You earn R12 000 per month. Tax is 18% of earnings above R7 000. How much tax do you pay?', 'Taxable = 12 000 − 7 000 = R5 000. Tax = 18% × 5 000 = R900.', 5, 'medium'),

-- ── Geography (Grades 10, 11, 12) ──
('Geography', 10, 'Define weather and climate. How are they different?', 'Weather is the day-to-day condition of the atmosphere (temperature, rainfall, wind on a given day). Climate is the average weather of a region over a long period (usually 30+ years).', 4, 'easy'),
('Geography', 10, 'Name the two main types of rainfall and briefly describe each.', 'Convectional rainfall: warm air rises rapidly, cools, condenses (common in summer in SA highveld). Orographic (relief) rainfall: air is forced up over mountains, cools and rains (common on the eastern escarpment).', 6, 'medium'),
('Geography', 11, 'Explain the difference between renewable and non-renewable energy. Give one SA example of each.', 'Renewable energy is replenished naturally (e.g. wind, solar, hydro — SA has wind farms in the Eastern Cape). Non-renewable energy is finite (e.g. coal — Mpumalanga power stations).', 5, 'medium'),
('Geography', 11, 'What is urbanisation? Name two reasons why people move from rural to urban areas in South Africa.', 'Urbanisation is the increase in the proportion of people living in cities. SA push/pull factors: (1) better job opportunities in cities, (2) better access to services like healthcare and schools.', 5, 'medium'),
('Geography', 12, 'Describe the structure of a settlement hierarchy from smallest to largest.', 'Hamlet → village → town → city → metropolis → megacity. Each step has a larger population, more services and a wider sphere of influence.', 6, 'medium'),
('Geography', 12, 'What is a drainage basin and what are the main features of a river system?', 'A drainage basin is the area drained by a river and its tributaries. Main features: source (where it starts), tributaries (smaller rivers joining), watershed (boundary), mouth (where it ends — usually the sea).', 6, 'medium'),

-- ── Accounting (Grades 10, 11, 12) ──
('Accounting', 10, 'Define the accounting equation.', 'Owner''s Equity = Assets − Liabilities. (Or: Assets = Owner''s Equity + Liabilities.)', 3, 'easy'),
('Accounting', 10, 'Classify each as Asset, Liability or Owner''s Equity: (a) Bank loan, (b) Vehicles, (c) Capital.', '(a) Liability, (b) Asset, (c) Owner''s Equity.', 3, 'easy'),
('Accounting', 10, 'What is the difference between a debtor and a creditor?', 'A debtor is someone who owes you money (a customer who bought on credit). A creditor is someone you owe money to (a supplier who sold to you on credit).', 4, 'easy'),
('Accounting', 11, 'A business buys stock worth R5 000 on credit. Show the double entry (debit/credit).', 'Debit: Trading Stock R5 000. Credit: Creditors Control R5 000.', 5, 'medium'),
('Accounting', 11, 'Define depreciation and name one method of calculating it.', 'Depreciation is the loss in value of a fixed asset over time due to wear and tear or obsolescence. Methods: straight-line (equal amount each year) or diminishing balance (percentage of remaining value).', 5, 'medium'),
('Accounting', 12, 'Calculate the cost of sales given: Opening stock R20 000, Purchases R80 000, Closing stock R15 000.', 'Cost of sales = Opening stock + Purchases − Closing stock = 20 000 + 80 000 − 15 000 = R85 000.', 5, 'medium'),

-- ── Business Studies (Grades 10, 11, 12) ──
('Business Studies', 10, 'List three types of business ownership in South Africa.', 'Sole trader, partnership, close corporation (CC), private company (Pty) Ltd, public company (Ltd), co-operative.', 4, 'easy'),
('Business Studies', 10, 'What is the difference between a need and a want? Give one example of each.', 'A need is essential for survival (food, water, shelter). A want is desired but not essential (a smartphone, designer clothes).', 4, 'easy'),
('Business Studies', 11, 'Name and briefly describe two methods of advertising.', 'Print (newspapers, magazines — reaches specific readers but expensive). Digital/social media (Facebook, TikTok — targeted, measurable, often cheaper).', 5, 'medium'),
('Business Studies', 11, 'What is BBBEE and why is it important in South Africa?', 'Broad-Based Black Economic Empowerment is government policy to address historical economic inequality by encouraging ownership, management and skills development of previously disadvantaged groups. It is measured via a scorecard that affects government contracts.', 6, 'medium'),
('Business Studies', 12, 'Explain the four functions of management.', 'Planning (setting goals and how to reach them), Organising (allocating resources and people), Leading (motivating and directing staff), Controlling (measuring performance against the plan and correcting).', 8, 'medium'),
('Business Studies', 12, 'What is corporate social responsibility (CSR)? Give one example.', 'CSR is when a business takes responsibility for its impact on society and the environment beyond just making profit. Example: a mining company building a school in the community where it operates.', 5, 'medium')

ON CONFLICT (subject, grade, question_text) DO NOTHING;


-- ############################################################################
-- PART 9 — Verification (expect every row ok = true)
-- ############################################################################
select check_name, ok from (values
  ('tables', (select count(*) = 17 from information_schema.tables where table_schema = 'public' and table_name in (
     'profiles','chat_sessions','chat_messages','feedback','lessons','practice_questions','user_answers',
     'parent_student_links','link_codes','teacher_classes','class_enrollments','rate_limits','lesson_views',
     'buddy_companions','learner_memory','curricula','ultraplans'))),
  ('signup_applications', to_regclass('public.signup_applications') is not null),
  ('practice_questions seeded', (select count(*) > 50 from public.practice_questions)),
  ('fn redeem_link_code', to_regprocedure('public.redeem_link_code(text)') is not null),
  ('fn enroll_student_by_email', to_regprocedure('public.enroll_student_by_email(uuid,text)') is not null),
  ('fn bump_rate_limit', to_regprocedure('public.bump_rate_limit(text,integer)') is not null),
  ('lesson_views.topic_key', exists (select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'lesson_views' and column_name = 'topic_key'))
) as t(check_name, ok);

