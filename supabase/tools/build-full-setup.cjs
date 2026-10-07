// Regenerates supabase/FULL_SETUP_FRESH_PROJECT.sql from the individual SQL files.
// Run: node supabase/tools/build-full-setup.cjs
const fs = require('fs'), path = require('path');
const R = path.resolve(__dirname, '../..') + '/';
const rd = f => fs.readFileSync(R + f, 'utf8').replace(/\r\n/g, '\n');
const cut = (s, marker) => { const i = s.indexOf(marker); if (i < 0) throw new Error('no marker ' + marker); return s.slice(0, i); };
const part = (n, title, body) => `\n-- ############################################################################\n-- PART ${n} — ${title}\n-- ############################################################################\n` + body.trimEnd() + '\n\n';
let out = fs.readFileSync(path.join(__dirname, 'head001.sql'), 'utf8');
out += part(3, 'SUPABASE_SETUP.sql (002 schema + claw features + core seed)', rd('SUPABASE_SETUP.sql'));
out += part(4, 'SUPABASE_FIX_RLS.sql', cut(rd('SUPABASE_FIX_RLS.sql'), '-- 4) Verify'));
out += part(5, 'SUPABASE_PHASE2.sql', cut(rd('SUPABASE_PHASE2.sql'), '-- ── 4. Verify'));
out += part(6, 'SUPABASE_PHASE3.sql', cut(rd('SUPABASE_PHASE3.sql'), '-- Verify'));
out += part(7, 'supabase/migrations/20261007000000_pilot_fixes.sql', rd('supabase/migrations/20261007000000_pilot_fixes.sql'));
out += part(8, 'SUPABASE_SEED_MORE.sql', rd('SUPABASE_SEED_MORE.sql'));
out += part(9, 'Verification (expect every row ok = true)', `select check_name, ok from (values
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
) as t(check_name, ok);`);
fs.writeFileSync(R + 'supabase/FULL_SETUP_FRESH_PROJECT.sql', out);
console.log('written', out.length);
