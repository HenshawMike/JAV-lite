-- ============================================================================
-- 004_v2_core_schema.sql
-- JAV Lite Build Document v2.0 - Complete Schema Migration
-- Safe & Idempotent: Can be pasted into Supabase SQL Editor on a fresh or v1 DB
-- ============================================================================

-- 0. Ensure Required Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Create Enums if they don't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('student', 'lecturer', 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_kind') THEN
    CREATE TYPE session_kind AS ENUM ('class', 'event');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_status') THEN
    CREATE TYPE session_status AS ENUM ('open', 'ended');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'correction_status') THEN
    CREATE TYPE correction_status AS ENUM ('open', 'resolved', 'rejected');
  END IF;
END $$;

-- 2. Organizations: Schools, Faculties, Departments
CREATE TABLE IF NOT EXISTS public.schools (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.faculties (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (school_id, name)
);

CREATE TABLE IF NOT EXISTS public.departments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  faculty_id uuid REFERENCES public.faculties(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (faculty_id, name)
);

-- 3. Profiles
-- Adapt existing profiles table or create fresh
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email text UNIQUE NOT NULL,
  full_name text,
  role user_role NOT NULL DEFAULT 'student',
  lecturer_status text CHECK (lecturer_status IN ('pending', 'approved', 'rejected')),
  track_no text UNIQUE,
  level text,
  school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  faculty_id uuid REFERENCES public.faculties(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  registered boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Ensure newly added columns exist if table was previously created in v1
DO $$ 
DECLARE
  pol record;
  con record;
BEGIN
  -- Drop legacy RLS policies on profiles that compare role as text (avoids 42883 operator does not exist)
  FOR pol IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;

  -- Drop legacy check constraints on profiles involving role
  FOR con IN (
    SELECT conname 
    FROM pg_constraint 
    WHERE conrelid = 'public.profiles'::regclass 
      AND contype = 'c' 
      AND pg_get_constraintdef(oid) LIKE '%role%'
  ) LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS %I', con.conname);
  END LOOP;

  -- role column check & conversion to user_role enum
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role') THEN
    ALTER TABLE public.profiles ADD COLUMN role user_role NOT NULL DEFAULT 'student';
  ELSE
    IF (SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role') = 'text' THEN
      -- Clean up any invalid values before converting
      EXECUTE 'UPDATE public.profiles SET role = ''student'' WHERE role IS NULL OR role NOT IN (''student'', ''lecturer'', ''admin'')';
      ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT;
      ALTER TABLE public.profiles ALTER COLUMN role TYPE user_role USING (COALESCE(role, 'student')::user_role);
      ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'student'::user_role;
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'lecturer_status') THEN
    ALTER TABLE public.profiles ADD COLUMN lecturer_status text CHECK (lecturer_status IN ('pending', 'approved', 'rejected'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'school_id') THEN
    ALTER TABLE public.profiles ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'faculty_id') THEN
    ALTER TABLE public.profiles ADD COLUMN faculty_id uuid REFERENCES public.faculties(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'department_id') THEN
    ALTER TABLE public.profiles ADD COLUMN department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Rosters (Optional class / department lists matched by track_no)
CREATE TABLE IF NOT EXISTS public.roster (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
  session_group_id uuid,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  track_no text NOT NULL,
  level text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (department_id, track_no)
);

-- 5. Sessions (Classes & Events unified)
CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  kind session_kind NOT NULL,
  name text NOT NULL,
  course_code text,
  description text,
  host_name text NOT NULL,
  school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  school_name text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status session_status NOT NULL DEFAULT 'open',
  rotating boolean NOT NULL DEFAULT true,
  qr_secret text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 6. Attendance with Snapshot Data
-- If v1 attendance table exists with event_id, back it up to attendance_v1 to avoid conflict
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'attendance' AND column_name = 'session_id') THEN
      ALTER TABLE public.attendance RENAME TO attendance_v1;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  student_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  full_name text NOT NULL,
  track_no text NOT NULL,
  level text,
  school_name text,
  faculty_name text,
  department_name text,
  entry_type text NOT NULL DEFAULT 'qr' CHECK (entry_type IN ('qr', 'manual')),
  marked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);

-- 7. Consents (Immutable)
CREATE TABLE IF NOT EXISTS public.consents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  doc_type text NOT NULL CHECK (doc_type IN ('privacy', 'terms')),
  version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  ip_hash text
);

-- 8. Reports (Immutable Report Hashes)
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  generated_by uuid REFERENCES public.profiles(id) NOT NULL,
  scope jsonb NOT NULL,
  sha256 text NOT NULL,
  report_code text,
  created_at timestamptz DEFAULT now()
);

-- 9. Correction Requests (Problem Reports)
CREATE TABLE IF NOT EXISTS public.correction_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  attendance_id uuid REFERENCES public.attendance(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 500),
  status correction_status NOT NULL DEFAULT 'open',
  response text CHECK (char_length(response) <= 500),
  handled_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  handled_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS one_open_request
  ON public.correction_requests (student_id, session_id) WHERE status = 'open';

-- 10. Audit Tables
CREATE TABLE IF NOT EXISTS public.profile_edits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  edited_by uuid REFERENCES public.profiles(id) NOT NULL,
  field text NOT NULL CHECK (field IN ('track_no', 'level')),
  old_value text,
  new_value text,
  reason text NOT NULL,
  applied_to_past_records boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attendance_audit (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  attendance_id uuid REFERENCES public.attendance(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  student_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  action text NOT NULL CHECK (action IN ('manual_add', 'manual_remove', 'snapshot_update')),
  changed_by uuid REFERENCES public.profiles(id) NOT NULL,
  reason text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- Security Definer Helpers (RLS without infinite recursion)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.my_role() RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_is_admin boolean := false;
BEGIN
  -- 1. Check v2 role = 'admin'
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'::user_role) THEN
    RETURN true;
  END IF;

  -- 2. Check legacy v1 is_admin boolean column if it exists in the table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_admin'
  ) THEN
    EXECUTE 'SELECT COALESCE(is_admin, false) FROM public.profiles WHERE id = $1'
      INTO v_is_admin
      USING auth.uid();
    IF v_is_admin THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END $$;

CREATE OR REPLACE FUNCTION public.is_approved_lecturer() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'lecturer'::user_role AND lecturer_status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_report_session(sid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.attendance
    WHERE session_id = sid AND student_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.sessions s
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE s.id = sid AND s.school_id = p.school_id
      AND s.started_at > now() - interval '14 days'
  );
$$;

-- ============================================================================
-- Triggers & Guard Functions
-- ============================================================================

-- Guard correction updates
CREATE OR REPLACE FUNCTION public.guard_correction_update() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.student_id IS DISTINCT FROM OLD.student_id
     OR NEW.session_id IS DISTINCT FROM OLD.session_id
     OR NEW.attendance_id IS DISTINCT FROM OLD.attendance_id
     OR NEW.reason IS DISTINCT FROM OLD.reason
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'These fields cannot be changed';
  END IF;
  NEW.handled_by := auth.uid();
  NEW.handled_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS correction_guard ON public.correction_requests;
CREATE TRIGGER correction_guard BEFORE UPDATE ON public.correction_requests
  FOR EACH ROW EXECUTE PROCEDURE public.guard_correction_update();

-- Correction rate limiter: max 5 per hour
CREATE OR REPLACE FUNCTION public.limit_correction_rate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.correction_requests
      WHERE student_id = NEW.student_id
        AND created_at > now() - interval '1 hour') >= 5 THEN
    RAISE EXCEPTION 'Too many requests. Try again later.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS correction_rate ON public.correction_requests;
CREATE TRIGGER correction_rate BEFORE INSERT ON public.correction_requests
  FOR EACH ROW EXECUTE PROCEDURE public.limit_correction_rate();

-- Guard profile updates:
-- 1. Prevents non-admins from self-approving as lecturer
-- 2. Prevents non-admins from granting themselves admin role
-- 3. Locks role, track_no, and level once student is registered (only admin can change)
CREATE OR REPLACE FUNCTION public.guard_profile_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    -- Block non-admin self-approval as lecturer
    IF NEW.lecturer_status = 'approved' AND (OLD.lecturer_status IS DISTINCT FROM 'approved') THEN
      RAISE EXCEPTION 'Only an administrator can approve a lecturer';
    END IF;

    -- Block non-admin setting role to admin
    IF NEW.role = 'admin'::user_role AND (OLD.role IS DISTINCT FROM 'admin'::user_role) THEN
      RAISE EXCEPTION 'Only an administrator can grant admin privileges';
    END IF;

    -- Once registered, lock role and credentials from self-edits
    IF OLD.registered = true THEN
      IF NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION 'Role cannot be changed after registration';
      END IF;
      IF (OLD.track_no IS NOT NULL AND OLD.track_no <> '' AND NEW.track_no IS DISTINCT FROM OLD.track_no)
         OR (OLD.level IS NOT NULL AND OLD.level <> '' AND NEW.level IS DISTINCT FROM OLD.level) THEN
        RAISE EXCEPTION 'Only an administrator can edit track number or level';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_guard ON public.profiles;
CREATE TRIGGER profiles_guard BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.guard_profile_update();

-- Auto-handle new user trigger on auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, registered)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    'student'::user_role,
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Admin edit student function
CREATE OR REPLACE FUNCTION public.admin_edit_student(
  p_student_id uuid,
  p_field text,
  p_new_value text,
  p_reason text,
  p_apply_to_past boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old_value text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: only admins can edit students';
  END IF;

  IF p_field NOT IN ('track_no', 'level') THEN
    RAISE EXCEPTION 'Invalid field to edit';
  END IF;

  IF p_field = 'track_no' THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE track_no = p_new_value AND id <> p_student_id) THEN
      RAISE EXCEPTION 'Track number already in use by another student';
    END IF;
    SELECT track_no INTO v_old_value FROM public.profiles WHERE id = p_student_id;
    UPDATE public.profiles SET track_no = p_new_value WHERE id = p_student_id;

    IF p_apply_to_past THEN
      UPDATE public.attendance SET track_no = p_new_value WHERE student_id = p_student_id;
    END IF;
  ELSIF p_field = 'level' THEN
    SELECT level INTO v_old_value FROM public.profiles WHERE id = p_student_id;
    UPDATE public.profiles SET level = p_new_value WHERE id = p_student_id;

    IF p_apply_to_past THEN
      UPDATE public.attendance SET level = p_new_value WHERE student_id = p_student_id;
    END IF;
  END IF;

  -- Insert audit log into profile_edits
  INSERT INTO public.profile_edits (
    student_id, edited_by, field, old_value, new_value, reason, applied_to_past_records
  ) VALUES (
    p_student_id, auth.uid(), p_field, v_old_value, p_new_value, p_reason, p_apply_to_past
  );
END $$;

-- ============================================================================
-- Views (with security_invoker = true to satisfy Supabase security linter)
-- ============================================================================

-- Safe session view without qr_secret for student Classes/Events tab
DROP VIEW IF EXISTS public.session_public;
CREATE VIEW public.session_public WITH (security_invoker = true) AS
  SELECT
    id,
    kind,
    name,
    course_code,
    description,
    host_name,
    school_id,
    school_name,
    created_by,
    status,
    rotating,
    session_date,
    started_at,
    expires_at,
    ended_at
  FROM public.sessions;

-- Student's My Records view
DROP VIEW IF EXISTS public.my_records;
CREATE VIEW public.my_records WITH (security_invoker = true) AS
  SELECT
    a.id,
    a.session_id,
    s.name AS session_name,
    s.kind,
    s.course_code,
    s.host_name,
    s.session_date,
    a.entry_type,
    a.full_name,
    a.track_no,
    a.level,
    a.school_name,
    a.faculty_name,
    a.department_name,
    a.marked_at
  FROM public.attendance a
  JOIN public.sessions s ON s.id = a.session_id
  WHERE a.student_id = auth.uid();

-- ============================================================================
-- Row Level Security (RLS) Configuration
-- ============================================================================

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correction_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_audit ENABLE ROW LEVEL SECURITY;

-- Schools, Faculties, Departments
DROP POLICY IF EXISTS "Public read schools" ON public.schools;
CREATE POLICY "Public read schools" ON public.schools FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin write schools" ON public.schools;
CREATE POLICY "Admin write schools" ON public.schools FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public read faculties" ON public.faculties;
CREATE POLICY "Public read faculties" ON public.faculties FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin write faculties" ON public.faculties;
CREATE POLICY "Admin write faculties" ON public.faculties FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public read departments" ON public.departments;
CREATE POLICY "Public read departments" ON public.departments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin write departments" ON public.departments;
CREATE POLICY "Admin write departments" ON public.departments FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Profiles
DROP POLICY IF EXISTS "Read own profile or staff read all" ON public.profiles;
CREATE POLICY "Read own profile or staff read all" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin() OR public.is_approved_lecturer());

DROP POLICY IF EXISTS "Update own profile" ON public.profiles;
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- Sessions
-- Lecturer/host can read and update their own sessions; Admin reads and updates all;
-- Students can read open sessions (via session_public view) and attended sessions (via my_records view)
DROP POLICY IF EXISTS "Session read policy" ON public.sessions;
DROP POLICY IF EXISTS "Session owner or admin read" ON public.sessions;
CREATE POLICY "Session read policy" ON public.sessions FOR SELECT TO authenticated
  USING (
    created_by = auth.uid() 
    OR public.is_admin() 
    OR status = 'open'
    OR EXISTS (SELECT 1 FROM public.attendance WHERE session_id = public.sessions.id AND student_id = auth.uid())
  );

DROP POLICY IF EXISTS "Create session policy" ON public.sessions;
CREATE POLICY "Create session policy" ON public.sessions FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_admin()) OR 
    (public.is_approved_lecturer() AND kind = 'class')
  );

DROP POLICY IF EXISTS "Update own session" ON public.sessions;
CREATE POLICY "Update own session" ON public.sessions FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin())
  WITH CHECK (created_by = auth.uid() OR public.is_admin());

-- Attendance
DROP POLICY IF EXISTS "Student reads own attendance" ON public.attendance;
CREATE POLICY "Student reads own attendance" ON public.attendance FOR SELECT TO authenticated
  USING (
    student_id = auth.uid() OR 
    public.is_admin() OR 
    EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.created_by = auth.uid())
  );

-- Consents
DROP POLICY IF EXISTS "Insert own consent" ON public.consents;
CREATE POLICY "Insert own consent" ON public.consents FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Read own consent or admin" ON public.consents;
CREATE POLICY "Read own consent or admin" ON public.consents FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- Correction Requests
DROP POLICY IF EXISTS "Student reports own" ON public.correction_requests;
CREATE POLICY "Student reports own" ON public.correction_requests FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid() AND status = 'open'
    AND response IS NULL AND handled_by IS NULL AND handled_at IS NULL
    AND public.can_report_session(session_id)
  );

DROP POLICY IF EXISTS "Student reads own" ON public.correction_requests;
CREATE POLICY "Student reads own" ON public.correction_requests FOR SELECT TO authenticated
  USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Owner reads" ON public.correction_requests;
CREATE POLICY "Owner reads" ON public.correction_requests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.created_by = auth.uid()));

DROP POLICY IF EXISTS "Admin reads" ON public.correction_requests;
CREATE POLICY "Admin reads" ON public.correction_requests FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Owner or admin answers" ON public.correction_requests;
CREATE POLICY "Owner or admin answers" ON public.correction_requests FOR UPDATE TO authenticated
  USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.created_by = auth.uid()));

-- Reports
DROP POLICY IF EXISTS "Report creator reads or admin" ON public.reports;
CREATE POLICY "Report creator reads or admin" ON public.reports FOR SELECT TO authenticated
  USING (generated_by = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Insert report" ON public.reports;
CREATE POLICY "Insert report" ON public.reports FOR INSERT TO authenticated
  WITH CHECK (generated_by = auth.uid() OR public.is_admin());

-- Audit Tables Read
DROP POLICY IF EXISTS "Admin read profile edits" ON public.profile_edits;
CREATE POLICY "Admin read profile edits" ON public.profile_edits FOR SELECT TO authenticated
  USING (public.is_admin() OR student_id = auth.uid());

DROP POLICY IF EXISTS "Staff read attendance audit" ON public.attendance_audit;
CREATE POLICY "Staff read attendance audit" ON public.attendance_audit FOR SELECT TO authenticated
  USING (public.is_admin() OR changed_by = auth.uid());

-- Rosters
DROP POLICY IF EXISTS "Admin full roster access" ON public.roster;
CREATE POLICY "Admin full roster access" ON public.roster FOR ALL TO authenticated
  USING (public.is_admin() OR owner_id = auth.uid())
  WITH CHECK (public.is_admin() OR owner_id = auth.uid());

-- ============================================================================
-- Data API Grants (Exposes tables & views to PostgREST)
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.session_public, public.my_records TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated;
