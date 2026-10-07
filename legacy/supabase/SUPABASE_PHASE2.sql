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

-- ── 4. Verify ─────────────────────────────────────────────
SELECT
  'profiles.dob' as col,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'dob') as ok
UNION ALL SELECT
  'role_escalation_trigger',
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'prevent_role_escalation_trigger')
UNION ALL SELECT
  'signup_applications_table',
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'signup_applications');
