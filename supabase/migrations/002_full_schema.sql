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

create policy if not exists "Users can insert own feedback"
  on public.feedback for insert
  with check (auth.uid() = user_id);

create policy if not exists "Users can view own feedback"
  on public.feedback for select
  using (auth.uid() = user_id);

-- Lessons: all authenticated users can read
create policy "Authenticated users can read lessons"
  on public.lessons for select
  using (auth.role() = 'authenticated');

-- Practice questions: all authenticated users can read
create policy "Authenticated users can read practice questions"
  on public.practice_questions for select
  using (auth.role() = 'authenticated');

-- User answers: own only
create policy "Users can insert own answers"
  on public.user_answers for insert
  with check (auth.uid() = user_id);

create policy "Users can view own answers"
  on public.user_answers for select
  using (auth.uid() = user_id);

-- Teachers can view answers for students in their classes
create policy "Teachers can view class student answers"
  on public.user_answers for select
  using (
    exists (
      select 1 from public.class_enrollments ce
      join public.teacher_classes tc on tc.id = ce.class_id
      where ce.student_id = user_answers.user_id
        and tc.teacher_id = auth.uid()
    )
  );

-- Parent–student links
create policy "Parents can view own links"
  on public.parent_student_links for select
  using (auth.uid() = parent_id);

create policy "Parents can insert own links"
  on public.parent_student_links for insert
  with check (auth.uid() = parent_id);

-- Link codes: students can manage their own codes
create policy "Students can create link codes"
  on public.link_codes for insert
  with check (auth.uid() = student_id);

create policy "Students can view own link codes"
  on public.link_codes for select
  using (auth.uid() = student_id);

-- Parents can look up a code (needed to redeem it)
create policy "Anyone authenticated can read link codes to redeem"
  on public.link_codes for select
  using (auth.role() = 'authenticated');

create policy "Parents can mark link codes as used"
  on public.link_codes for update
  using (auth.role() = 'authenticated');

-- Teacher classes
create policy "Teachers can manage own classes"
  on public.teacher_classes for all
  using (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);

-- Students/parents can see classes they're enrolled in
create policy "Students can see their classes"
  on public.teacher_classes for select
  using (
    exists (
      select 1 from public.class_enrollments
      where class_id = teacher_classes.id
        and student_id = auth.uid()
    )
  );

-- Class enrollments
create policy "Teachers can manage enrollments for their classes"
  on public.class_enrollments for all
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

create policy "Students can view own enrollments"
  on public.class_enrollments for select
  using (auth.uid() = student_id);

-- Rate limits: users manage own
create policy "Users can read own rate limits"
  on public.rate_limits for select
  using (auth.uid() = user_id);

create policy "Users can upsert own rate limits"
  on public.rate_limits for insert
  with check (auth.uid() = user_id);

create policy "Users can update own rate limits"
  on public.rate_limits for update
  using (auth.uid() = user_id);

-- Lesson views: own only, teachers can see class students
create policy "Users can log own lesson views"
  on public.lesson_views for insert
  with check (auth.uid() = user_id);

create policy "Users can see own lesson views"
  on public.lesson_views for select
  using (auth.uid() = user_id);

create policy "Teachers can see class students lesson views"
  on public.lesson_views for select
  using (
    exists (
      select 1 from public.class_enrollments ce
      join public.teacher_classes tc on tc.id = ce.class_id
      where ce.student_id = lesson_views.user_id
        and tc.teacher_id = auth.uid()
    )
  );

-- Parents can view linked student's lesson views
create policy "Parents can view linked student lesson views"
  on public.lesson_views for select
  using (
    exists (
      select 1 from public.parent_student_links
      where parent_id = auth.uid()
        and student_id = lesson_views.user_id
        and confirmed = true
    )
  );

-- Parents can view linked student's chat sessions
create policy "Parents can view linked student sessions"
  on public.chat_sessions for select
  using (
    exists (
      select 1 from public.parent_student_links
      where parent_id = auth.uid()
        and student_id = chat_sessions.user_id
        and confirmed = true
    )
  );

-- Parents can view linked student profiles
create policy "Parents can view linked student profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.parent_student_links
      where parent_id = auth.uid()
        and student_id = profiles.id
        and confirmed = true
    )
  );

-- Teachers can view enrolled student profiles
create policy "Teachers can view enrolled student profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.class_enrollments ce
      join public.teacher_classes tc on tc.id = ce.class_id
      where ce.student_id = profiles.id
        and tc.teacher_id = auth.uid()
    )
  );

-- Teachers can view enrolled student sessions
create policy "Teachers can view enrolled student sessions"
  on public.chat_sessions for select
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
('Mathematics', 11, 'Find the derivative of f(x) = 3x² − 4x + 7 using first principles or rules.', "f'(x) = 6x − 4", 5, 'hard'),

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

on conflict do nothing;
