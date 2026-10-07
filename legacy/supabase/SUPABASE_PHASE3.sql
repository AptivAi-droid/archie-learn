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

-- Verify
SELECT 'insert_trigger' AS check, EXISTS (
  SELECT 1 FROM pg_trigger WHERE tgname = 'prevent_initial_role_escalation_trigger'
) AS ok;
