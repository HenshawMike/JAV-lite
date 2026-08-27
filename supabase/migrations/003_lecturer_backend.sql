-- ============================================================
-- 003_lecturer_backend.sql (Idempotent / Safe to re-run)
-- Adds: role column, courses, class_sessions, class_attendance
-- ============================================================

-- ── 1. Role column on profiles ────────────────────────────────────────────
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'profiles' 
      AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles 
      ADD COLUMN role text DEFAULT 'student' 
      CHECK (role IN ('student', 'lecturer'));
  END IF;
END $$;

-- Allow lecturers and admins to read all profiles for attendee joins (name, photo, ID)
DROP POLICY IF EXISTS "Lecturer read all profiles" ON public.profiles;
CREATE POLICY "Lecturer read all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (role = 'lecturer' OR is_admin = true)
    )
  );

-- ── 2. Courses ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.courses (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lecturer_id   uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name          text NOT NULL,
  code          text,
  faculty       text NOT NULL,
  department    text NOT NULL,
  level         text NOT NULL,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read courses (students filter by their faculty/department/level)
DROP POLICY IF EXISTS "Public read courses" ON public.courses;
CREATE POLICY "Public read courses" ON public.courses
  FOR SELECT USING (true);

-- Only the owning lecturer can insert/update/delete their courses
DROP POLICY IF EXISTS "Lecturer manage own courses" ON public.courses;
CREATE POLICY "Lecturer manage own courses" ON public.courses
  FOR ALL TO authenticated
  USING (auth.uid() = lecturer_id)
  WITH CHECK (auth.uid() = lecturer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;

-- ── 3. Class Sessions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.class_sessions (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id     uuid REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  lecturer_id   uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title         text,
  date          date NOT NULL DEFAULT CURRENT_DATE,
  is_active     boolean DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;

-- Anyone can read sessions
DROP POLICY IF EXISTS "Public read class sessions" ON public.class_sessions;
CREATE POLICY "Public read class sessions" ON public.class_sessions
  FOR SELECT USING (true);

-- Only the owning lecturer can manage sessions
DROP POLICY IF EXISTS "Lecturer manage own sessions" ON public.class_sessions;
CREATE POLICY "Lecturer manage own sessions" ON public.class_sessions
  FOR ALL TO authenticated
  USING (auth.uid() = lecturer_id)
  WITH CHECK (auth.uid() = lecturer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_sessions TO authenticated;

-- Trigger: when a session is set active, deactivate all others for the same course
CREATE OR REPLACE FUNCTION public.deactivate_other_sessions()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = TRUE THEN
    UPDATE public.class_sessions
      SET is_active = FALSE
      WHERE course_id = NEW.course_id
        AND id != NEW.id
        AND is_active = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS one_active_session_per_course ON public.class_sessions;
CREATE TRIGGER one_active_session_per_course
  AFTER INSERT OR UPDATE ON public.class_sessions
  FOR EACH ROW EXECUTE FUNCTION public.deactivate_other_sessions();

-- ── 4. Class Attendance ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.class_attendance (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id    uuid REFERENCES public.class_sessions(id) ON DELETE CASCADE NOT NULL,
  student_id    uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  marked_at     timestamptz DEFAULT now(),
  status        text DEFAULT 'pending',
  UNIQUE(session_id, student_id)
);

ALTER TABLE public.class_attendance ENABLE ROW LEVEL SECURITY;

-- Students can insert their own attendance
DROP POLICY IF EXISTS "Student mark class attendance" ON public.class_attendance;
CREATE POLICY "Student mark class attendance" ON public.class_attendance
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_id);

-- Students can read their own class attendance rows
DROP POLICY IF EXISTS "Student read own class attendance" ON public.class_attendance;
CREATE POLICY "Student read own class attendance" ON public.class_attendance
  FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

-- Lecturers can read attendance for sessions they own
DROP POLICY IF EXISTS "Lecturer read own session attendance" ON public.class_attendance;
CREATE POLICY "Lecturer read own session attendance" ON public.class_attendance
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.class_sessions cs
      WHERE cs.id = session_id AND cs.lecturer_id = auth.uid()
    )
  );

-- Lecturers can confirm/update attendance status for their own sessions
DROP POLICY IF EXISTS "Lecturer confirm attendance" ON public.class_attendance;
CREATE POLICY "Lecturer confirm attendance" ON public.class_attendance
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.class_sessions cs
      WHERE cs.id = session_id AND cs.lecturer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.class_sessions cs
      WHERE cs.id = session_id AND cs.lecturer_id = auth.uid()
    )
  );

-- Admins can read all class attendance
DROP POLICY IF EXISTS "Admin read all class attendance" ON public.class_attendance;
CREATE POLICY "Admin read all class attendance" ON public.class_attendance
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

GRANT SELECT, INSERT, UPDATE ON public.class_attendance TO authenticated;
