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

-- 4) Verify
SELECT
  (SELECT count(*) FROM public.practice_questions) AS practice_questions,
  (SELECT count(*) FROM public.teacher_classes) AS teacher_classes_accessible;
