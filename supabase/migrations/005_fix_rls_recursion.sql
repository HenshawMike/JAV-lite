-- ============================================================================
-- 005_fix_rls_recursion.sql
-- Fix: Infinite recursion in sessions RLS policy (PGRST301)
-- Fix: column attendance.event_id does not exist (42703)
-- ============================================================================

-- 1. Helper: safely check if current user has attended a given session
-- Uses SECURITY DEFINER to bypass RLS on attendance, breaking circular RLS evaluation.
CREATE OR REPLACE FUNCTION public.attended_session(sid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.attendance
    WHERE session_id = sid AND student_id = auth.uid()
  );
$$;

-- 2. Helper: safely check if current user is owner of a session
-- Uses SECURITY DEFINER to bypass RLS on sessions when queried from attendance policy.
CREATE OR REPLACE FUNCTION public.owns_session(sid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sessions
    WHERE id = sid AND created_by = auth.uid()
  );
$$;

-- 3. Replace recursive sessions SELECT policy
DROP POLICY IF EXISTS "Session read policy" ON public.sessions;
DROP POLICY IF EXISTS "Session owner or admin read" ON public.sessions;
CREATE POLICY "Session read policy" ON public.sessions FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_admin()
    OR status = 'open'
    OR public.attended_session(id)
  );

-- 4. Replace attendance SELECT policy using owns_session helper
DROP POLICY IF EXISTS "Student reads own attendance" ON public.attendance;
CREATE POLICY "Student reads own attendance" ON public.attendance FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR public.is_admin()
    OR public.owns_session(session_id)
  );

-- 5. Attendance INSERT policy (for students marking their own attendance)
DROP POLICY IF EXISTS "Student mark attendance" ON public.attendance;
CREATE POLICY "Student mark attendance" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

-- 6. Grants
GRANT EXECUTE ON FUNCTION public.attended_session(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owns_session(uuid) TO authenticated, service_role;

-- 7. Backward Compatibility: Ensure event_id and status columns exist on public.attendance
-- This prevents error 42703 (column attendance.event_id does not exist) from breaking any
-- existing queries or legacy workflows.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendance' AND column_name = 'event_id'
  ) THEN
    ALTER TABLE public.attendance ADD COLUMN event_id uuid;
    UPDATE public.attendance SET event_id = session_id WHERE event_id IS NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendance' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.attendance ADD COLUMN status text NOT NULL DEFAULT 'confirmed';
  END IF;
END $$;

-- 8. Auto-sync trigger for event_id and session_id
CREATE OR REPLACE FUNCTION public.sync_attendance_event_session_ids()
RETURNS trigger AS $$
BEGIN
  IF NEW.session_id IS NULL AND NEW.event_id IS NOT NULL THEN
    NEW.session_id := NEW.event_id;
  ELSIF NEW.event_id IS NULL AND NEW.session_id IS NOT NULL THEN
    NEW.event_id := NEW.session_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_attendance_ids ON public.attendance;
CREATE TRIGGER trg_sync_attendance_ids
  BEFORE INSERT OR UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.sync_attendance_event_session_ids();

-- 9. Allow lecturers and admins to delete their own created sessions/classes
DROP POLICY IF EXISTS "Delete own session" ON public.sessions;
CREATE POLICY "Delete own session" ON public.sessions FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin());

-- 10. Support cancelled status for sessions/events
DO $$ BEGIN
  ALTER TYPE session_status ADD VALUE IF NOT EXISTS 'cancelled';
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN undefined_object THEN null;
END $$;


