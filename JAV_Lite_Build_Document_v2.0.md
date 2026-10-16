# JAV Lite — Build Document v2.0

**Blim Technologies** · Supersedes v1.0 · Updated 9 October 2026
**Stack:** Next.js 14 · Supabase · Google OAuth · Edge Functions

> **v2.1 update (decisions you confirmed):** admins can edit a student's track number and level (Section 8.1). The rotating QR stays on and is verified live on the student form (Section 6.5). Students get a read-only, copy-protected My Records page (Section 6.6). The legal appendices were adjusted to match.
>
> **v2.2 update:** there is no face capture anywhere in the sign-up or registration process. The app collects no face photos, so the photo field, the Cloudinary integration and the related consent, privacy and terms text have been removed.

---

## 1. What changed in v2.0

| Area | v1.0 | v2.0 |
|---|---|---|
| Roles | Student, admin (`is_admin` flag) | Student, lecturer, admin (`role` field) |
| Attendance | One active event, student taps Attend | QR sessions (classes and events), many open at once |
| Student home | Single Attend page | Classes and Events tabs plus a centre-bottom scan button |
| Registration | Form, face photo required | Form opens after first scan, no face photo |
| Org structure | Flat department list | School → Faculty → Department, managed by admin |
| Reports | Admin CSV only | Admin CSV, lecturer CSV, lecturer PDF report with statistics |
| Legal | None | Privacy Policy, Terms, recorded consent (Appendices A and B) |

---

## 2. Recommendations I have built into this version

You asked me to suggest what is best and follow it. These are the decisions, with the reason for each. **You have confirmed all eleven decisions below (v2.2).**

1. **One sessions table for classes and events.** A class and an event differ only by kind and owner. One table means one QR system, one scanner, one report engine.
2. **Several sessions open at the same time.** v1 allowed one active event. Many lecturers teach in parallel, so that rule is removed.
3. **Rotating QR codes.** The QR the lecturer shows refreshes every 30 seconds. Without this, one student can photograph the code and send it to friends who are not in the room. This is the biggest cheating risk in any QR attendance system. Lecturers can switch rotation off for a static code.
4. **Google sign-in is required before marking.** Scanning while signed out sends the student through Google first, then straight back to the form. This stops anonymous or fake entries and ties every record to a real account.
5. **Snapshot the student's details on each attendance row.** If a student later changes department or name, old reports must not change. Reports read the snapshot.
6. **Lecturers are verified by the admin.** Anyone can pick "lecturer" at sign-up, so a lecturer account stays pending until an admin approves it. Otherwise a student could create a class and fake reports.
7. **Sessions auto-end.** Default 3 hours for classes, 12 hours for events, so a forgotten QR cannot be used the next day. The lecturer or admin can still end it manually.
8. **Exports run through the user's own login, not the service-role key.** v1 used the service key in an Edge Function, which skips all security. v2 exports use Row Level Security, so a lecturer can only ever export their own classes.
9. **Reports carry a Report ID and a hash.** A report submitted to a school can be checked later to prove it was not edited.
10. **Consent is stored, with version and time.** This is how you answer complaints (Section 11).
11. **Roster is optional.** "Absent" only has meaning if you know who should be there. Lecturers may upload a class list and admins keep department rosters. Without a list, reports show attendees only.

**Confirmed in v2.1:** you wrote that the admin can "add names to any department". I read this two ways and built both:

- (a) the admin adds and renames departments (and schools and faculties), and
- (b) the admin adds student names to a department as a roster, which students are matched to by track number.

---

## 3. Roles and flows

### 3.1 Student

1. Opens the site and taps **Sign in with Google**.
2. Accepts the Terms and Privacy Policy (checkbox, first time only).
3. Lands on the home screen with Classes and Events tabs and the scan button at the bottom centre.
4. Taps scan, camera opens, scans a JAV QR.
5. First time: a form opens with name, track number, level, school, faculty, department. There is no face capture. Submitting registers the student and marks attendance in one step.
6. Later scans: details are pre-filled and attendance is marked with one confirmation tap.

### 3.2 Lecturer

1. Signs in with Google, chooses **I am a lecturer**, enters full name and school. Account waits for admin approval.
2. After approval, sees their classes and a **+** button.
3. Taps **+**, enters class name (course code optional), confirms lecturer name and school, and taps **Start**.
4. A full-screen QR appears with a live counter of students marked. Lecturer taps **End session** when done.
5. Opens any class for the list, **Export CSV** and **Generate PDF report**.

### 3.3 Admin

1. Manages schools, faculties and departments, and the department rosters.
2. Approves lecturers.
3. Creates events with the same **+** and QR screen as lecturers.
4. Views all students by department and exports event reports.

---

## 4. Database schema

Replace the v1 tables with the following. Run as `002_v2_schema.sql`.

```sql
create type user_role as enum ('student','lecturer','admin');
create type session_kind as enum ('class','event');
create type session_status as enum ('open','ended');

create table public.schools (
  id uuid default gen_random_uuid() primary key,
  name text unique not null
);
create table public.faculties (
  id uuid default gen_random_uuid() primary key,
  school_id uuid references public.schools(id) on delete cascade not null,
  name text not null,
  unique (school_id, name)
);
create table public.departments (
  id uuid default gen_random_uuid() primary key,
  faculty_id uuid references public.faculties(id) on delete cascade not null,
  name text not null,
  unique (faculty_id, name)
);

create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text unique not null,
  full_name text,
  role user_role not null default 'student',
  lecturer_status text check (lecturer_status in ('pending','approved','rejected')),
  track_no text unique,            -- null for lecturers; never store ''
  level text,
  school_id uuid references public.schools(id),
  faculty_id uuid references public.faculties(id),
  department_id uuid references public.departments(id),
  registered boolean default false,
  created_at timestamptz default now()
);

-- Optional class/department lists. Matched to students by track_no.
create table public.roster (
  id uuid default gen_random_uuid() primary key,
  department_id uuid references public.departments(id) on delete cascade,
  session_group_id uuid,           -- set when a lecturer uploads a class list
  owner_id uuid references public.profiles(id),
  full_name text not null,
  track_no text not null,
  level text,
  unique (department_id, track_no)
);

create table public.sessions (
  id uuid default gen_random_uuid() primary key,
  kind session_kind not null,
  name text not null,              -- class or event name
  course_code text,
  description text,
  host_name text not null,         -- lecturer or organiser name as typed
  school_id uuid references public.schools(id),
  school_name text not null,
  created_by uuid references public.profiles(id) not null,
  status session_status not null default 'open',
  rotating boolean not null default true,
  qr_secret text not null default encode(gen_random_bytes(32),'hex'),
  session_date date not null default current_date,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,  -- auto-end time
  ended_at timestamptz
);

create table public.attendance (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.sessions(id) on delete cascade not null,
  student_id uuid references public.profiles(id) on delete cascade not null,
  -- snapshot so old reports never change
  full_name text not null,
  track_no text not null,
  level text,
  school_name text,
  faculty_name text,
  department_name text,
  marked_at timestamptz not null default now(),
  unique (session_id, student_id)
);

create table public.consents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  doc_type text not null check (doc_type in ('privacy','terms')),
  version text not null,
  accepted_at timestamptz not null default now(),
  user_agent text,
  ip_hash text                     -- salted hash, not the raw IP
);

create table public.reports (
  id uuid default gen_random_uuid() primary key,
  generated_by uuid references public.profiles(id) not null,
  scope jsonb not null,            -- class name, date range, session ids
  sha256 text not null,
  created_at timestamptz default now()
);
```

Keep the v1 `handle_new_user` trigger, but make it insert `role = 'student'`.

### 4.1 Row Level Security

The v1 admin policies read `profiles` from inside a `profiles` policy, which causes infinite recursion. Use `security definer` helpers instead.

```sql
create function public.my_role() returns user_role
language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select public.my_role() = 'admin' $$;

create function public.is_approved_lecturer() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.profiles
   where id = auth.uid() and role = 'lecturer' and lecturer_status = 'approved') $$;
```

| Table | Policy summary |
|---|---|
| schools, faculties, departments | Anyone signed in can read. Only `is_admin()` can write. |
| profiles | Read and update own row. Admin reads all. Users may not change their own `role` or `lecturer_status` (enforce with a trigger or column privileges). |
| sessions | Owner reads and updates own. Admin reads all. Insert if `is_admin()` (any kind) or `is_approved_lecturer()` (`kind = class` only). Students read nothing directly. |
| attendance | Student reads own rows. Session owner reads rows for their sessions. Admin reads all. No direct insert: marking goes through the `mark-attendance` Edge Function. |
| roster | Admin full access. Lecturer manages rows they own. |
| consents | Insert and read own. Admin read. No update or delete, ever. |
| reports | Insert and read own. Admin read. |

Students never read `sessions` directly because the row holds `qr_secret`. Expose a view `public.session_public` (`id, kind, name, host_name, school_name, session_date, status`) for the Classes and Events tabs, and never include the secret.

---

## 5. The QR system

### 5.1 What the QR contains

The QR encodes a link, so it also works if someone uses their phone's own camera:

```
https://<your-domain>/scan?c=JAV1.<sessionId>.<window>.<signature>
```

- `JAV1` is the format prefix. The in-app scanner rejects anything that does not start with `JAV1.`, which is how "JAV-only" is enforced.
- `window = floor(unixSeconds / 30)` when rotating, or `0` when static.
- `signature` = first 16 hex characters of `HMAC-SHA256(qr_secret, sessionId + '.' + window)`.

### 5.2 Edge Functions

| Function | Caller | Job |
|---|---|---|
| `session-qr` | Session owner or admin | Checks ownership, returns the current QR string. The lecturer's screen calls it every 25 seconds. |
| `mark-attendance` | Signed-in student | Verifies the signature (current or previous window), session open and not past `expires_at`, then inserts the attendance row with a snapshot of the student's profile. Returns 409 if already marked. |
| `register-and-mark` | Signed-in new student | Same checks, plus saves the registration form, then marks. Runs in one transaction. |

`mark-attendance` and `register-and-mark` use the service-role key (they must insert past RLS), so they must read the user from the request JWT and **never trust a student ID sent in the body**.

**Expired sessions:** a scheduled function (`pg_cron`, every 10 minutes) sets `status = 'ended'` where `expires_at < now()`.

### 5.3 Libraries

- Generate QR: `qrcode` (or `qrcode.react`)
- Scan QR: `@yudiel/react-qr-scanner` or `html5-qrcode`
- Camera access needs HTTPS. It works on Netlify or Vercel production URLs and on localhost.

---

## 6. Student side

### 6.1 Layout

- Top bar: JAV Lite logo and the student's avatar.
- Two tabs: **Classes** and **Events**.
- Bottom bar: Home on the left, scan button in the centre, Profile on the right. The scan button is a raised circle in `--primary` with a QR icon.

### 6.2 Classes tab and Events tab

Both tabs use the same list component, filtered by `kind`.

| Section | Content |
|---|---|
| Open now | Open sessions the student's school can see (from `session_public`) with a note "Scan the lecturer's QR to mark". There is no attend button, since attendance only happens by QR. |
| My history | Sessions already attended: name, host, date, time marked, green tick. |

### 6.3 Scanner screen

1. Tap scan: request camera permission, full-screen viewfinder with a square guide.
2. Decoded text must start with `JAV1.` or the app shows "This is not a JAV Lite code".
3. Valid code: first-time student sees the registration form, returning student sees the confirm card (class name, host, date, time shown, all automatic).
4. Success screen with tick, class name and time. Errors are specific: session ended, code expired (rescan), already marked.

### 6.4 Registration form (first scan)

| Field | Type | Notes |
|---|---|---|
| Full name | text | Required, min 2 characters. Pre-filled from Google. |
| Track / ID number | text, monospace | Required, unique, checked on blur. Never submit an empty string. |
| Level | select | 100 to 500 |
| School | select | From `schools` |
| Faculty | select | Filtered by school |
| Department | select | Filtered by faculty |
| Consent | checkbox | Required on first use (Section 11) |

Time, date and class name are never typed. They are read from the session and the server clock.

### 6.5 Rotating code on the student form

The rotating code is checked the moment the student scans, and the form shows that check live. The student's phone is never given the current code to display, because a remote student could then read it out to friends.

1. On scan, the app calls `claim-session` with the scanned code. If the code is current (this window or the previous one) and the session is open, the function returns a **claim ticket**: signed, bound to this student and this session, valid for 10 minutes.
2. The form header shows the class or event name, host, school and date, a green **"Live code verified"** badge, and a countdown ring for the ticket ("Submit within 9:42").
3. Submit sends the ticket, not the original code. `register-and-mark` and `mark-attendance` accept the ticket, and still refuse if the session has been ended or has expired in the meantime.
4. If the ticket runs out, the form keeps everything typed and shows "Time is up. Scan the code again to continue". The student rescans and the form resumes with the same answers.

**Why a ticket and not the raw code:** a first-time registration takes longer than the 30-second code lifetime. The ticket lets slow typists finish, while the rotation still proves they scanned a live code at the start.

> **Assumption:** I read "let it show on the students form" as this live verification badge, not as printing the code on the student's screen. If you wanted the rotating code itself shown there, tell me and I will add it, with the warning that it weakens the anti-sharing protection.

### 6.6 My Records: view only, no copying

Students have a **My Records** page (reached from the Profile tab and from each history item). It shows what they attended and nothing else.

| Shown | Detail |
|---|---|
| Summary | Total classes and events attended, this term |
| List | Class or event name, host, date, time marked, entry type (QR or Manual) |
| Per class | "Attended 8 sessions" (and "of 10 held" when the lecturer has a class list) |
| Profile details | Name, track number, level, department as recorded, shown as plain text |

**It cannot be edited.**

- There are no input fields, edit buttons or delete buttons on the page.
- The database enforces it, not just the screen. Students have `select` rights only: no update or delete policy exists on `attendance`, and a trigger rejects student changes to track number and level (Section 8.1).
- The page reads from a view `my_records` (`security_invoker`) that returns only the signed-in student's own rows.
- A **Report a problem** button lets a student send a message to the lecturer (stored in `correction_requests`). It asks for a correction. It never changes the record. Full design in Section 6.7.

**Copy protection (deterrents):**

- CSS `user-select: none`, `-webkit-user-select: none` and `-webkit-touch-callout: none` on the whole page, so text cannot be highlighted or long-press copied.
- Event handlers that cancel `copy`, `cut`, `contextmenu`, `dragstart` and `selectstart`.
- No text in `input` or `textarea` elements, and no selectable table cells.
- `@media print { body { display: none } }` so the page does not print.
- A faint watermark tiled over the page with the student's name, track number and the time. A leaked screenshot then points back to its owner.
- Screen readers still work, so the page stays accessible.

**Be clear with users and with schools about the limit.** A browser cannot stop screenshots, screen recording, photographing the screen, or someone reading the page source with developer tools. These measures stop casual copying and make leaks traceable. The real protection is that a student's page only ever contains their own records, enforced by row-level security, so no one else's data is on it to leak. Do not describe this page as "copy-proof" in marketing or in the Terms.

### 6.7 Report a problem (saved to the database)

A student who thinks a record is wrong taps **Report a problem** on a history item. The request is saved straight to the database from the student's own signed-in session. There is no Edge Function and no service-role key in this path, so Row Level Security is the only gate, and it is strict.

**Form:** the session (pre-selected), a reason of 10 to 500 characters, and Submit. The student can see the status afterwards (Open, Resolved, Rejected) and the lecturer's short reply.

```sql
create type correction_status as enum ('open','resolved','rejected');

create table public.correction_requests (
  id uuid default gen_random_uuid() primary key,
  student_id uuid not null default auth.uid()
    references public.profiles(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  attendance_id uuid references public.attendance(id) on delete set null,
  reason text not null check (char_length(reason) between 10 and 500),
  status correction_status not null default 'open',
  response text check (char_length(response) <= 500),
  handled_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);

-- One open request per student per session
create unique index one_open_request
  on public.correction_requests (student_id, session_id) where status = 'open';

alter table public.correction_requests enable row level security;
alter table public.correction_requests force row level security;

-- May this student report this session? Only if they were recorded in it, or it
-- is a recent session at their own school.
create function public.can_report_session(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.attendance
                  where session_id = sid and student_id = auth.uid())
      or exists (select 1 from public.sessions s join public.profiles p on p.id = auth.uid()
                  where s.id = sid and s.school_id = p.school_id
                    and s.started_at > now() - interval '14 days')
$$;

-- Student: insert as themselves only, in the open state only
create policy "Student reports own" on public.correction_requests for insert
  to authenticated with check (
    student_id = auth.uid() and status = 'open'
    and response is null and handled_by is null and handled_at is null
    and public.can_report_session(session_id));

-- Student reads own; lecturer reads for own sessions; admin reads all
create policy "Student reads own" on public.correction_requests for select
  to authenticated using (student_id = auth.uid());
create policy "Owner reads" on public.correction_requests for select
  to authenticated using (exists (select 1 from public.sessions s
    where s.id = session_id and s.created_by = auth.uid()));
create policy "Admin reads" on public.correction_requests for select
  to authenticated using (public.is_admin());

-- Lecturer (session owner) or admin may answer. Students have no update policy.
create policy "Owner or admin answers" on public.correction_requests for update
  to authenticated
  using (public.is_admin() or exists (select 1 from public.sessions s
    where s.id = session_id and s.created_by = auth.uid()));

-- No delete policy exists, so nobody can delete a request.

-- Responders may change only status, response, handled_by, handled_at
create function public.guard_correction_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.student_id is distinct from old.student_id
     or new.session_id is distinct from old.session_id
     or new.attendance_id is distinct from old.attendance_id
     or new.reason is distinct from old.reason
     or new.created_at is distinct from old.created_at then
    raise exception 'These fields cannot be changed';
  end if;
  new.handled_by := auth.uid();
  new.handled_at := now();
  return new;
end $$;
create trigger correction_guard before update on public.correction_requests
  for each row execute procedure public.guard_correction_update();

-- Flood control: at most 5 requests per student per hour
create function public.limit_correction_rate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.correction_requests
       where student_id = new.student_id
         and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many requests. Try again later.';
  end if;
  return new;
end $$;
create trigger correction_rate before insert on public.correction_requests
  for each row execute procedure public.limit_correction_rate();
```

**What this blocks**

| Attack | Why it fails |
|---|---|
| Student files a request as another student | `student_id` must equal `auth.uid()` and defaults to it |
| Student reports a session at another school or an old one | `can_report_session` refuses it |
| Student marks their own request resolved, or writes a fake lecturer reply | Insert policy forces `open` with no response. Students have no update policy. |
| Student reads other students' requests | Select is limited to own rows |
| Student edits or deletes a request after sending | No update or delete policy for students |
| Lecturer reads or answers requests for someone else's class | Policy ties them to `sessions.created_by` |
| Spam flood | Rate trigger (5 per hour) and one open request per session |
| Script or HTML in the reason | Stored as plain text only and always shown as escaped text, never as HTML |
| Request changes the attendance record | The table is separate. Only a lecturer's audited manual action changes attendance. |

Lecturers see a badge with the number of open requests on the class page. Answering one with **Resolve** can open the manual-add screen (Section 7.5). Every answer shows who handled it and when. The request and the reply are kept for the same period as attendance records.

---

## 7. Lecturer side

### 7.1 Home

List of the lecturer's classes, newest first, with status chips (Open or Ended), the date and the number present. A floating **+** button sits at the bottom right.

### 7.2 Create class (the + button)

| Field | Notes |
|---|---|
| Class name | Required |
| Course code | Optional |
| Lecturer name | Pre-filled from profile, editable |
| School teaching | Select from schools, pre-filled |
| Auto-end after | 1 / 2 / 3 / 4 hours. Default 3. |
| Rotating QR | On by default |

Tapping **Start** inserts a `sessions` row (`kind = 'class'`) and opens the QR screen.

### 7.3 QR screen

Full-screen QR (white background, high contrast, readable from the back of a hall), class name and date, a live count of students marked (Supabase Realtime on `attendance`), a countdown to auto-end, and a red **End session** button with a confirmation dialog. A **Fullscreen / project** button helps with projectors.

### 7.4 Class detail

Tabs: **Sessions**, **Students**, **Reports**. Lecturers can start a new session for the same class with one tap, so a semester of Monday lectures builds one history for the report. Optional **Upload class list (CSV)** with columns `full_name, track_no, level` to enable absent counts.

### 7.5 Manual correction

A lecturer may add a student who could not scan (flat phone battery, for example) or remove a wrong entry. Every manual change writes a row to an `attendance_audit` log (who, what, when) and is marked "added manually" in reports. (Add the table in the same migration.)

---

## 8. Admin side

| Feature | Detail |
|---|---|
| Org manager | Add, rename, delete schools, faculties and departments. Deleting is blocked while students point to it. |
| Department rosters | Add a student by hand (name, track number, level) or upload a CSV. When a student registers with a matching track number, the roster row is linked. |
| Lecturer approvals | List of pending lecturers with name, email, school. Approve or reject. |
| Events | Same **+** and QR screen as lecturers, with `kind = 'event'`. Several events may be open at once. |
| Students by department | v1 dashboard retained. Coloured initials are shown, since no photos are collected. |
| Reports | Per-event records and CSV. Admin can also read any lecturer's class report. |

### 8.1 Admin edits to a student's track number and level

Admins can correct a student's track number and level. Students cannot change either after registration, so a record stays tied to the number the school knows.

**Screen:** on a student card, an admin taps **Edit**, changes the track number and/or level, and must type a reason (for example "typo at registration" or "promoted to 300 level"). A checkbox **"Also correct past attendance records"** is shown.

| Change | Checkbox default | Why |
|---|---|---|
| Track number | On | Usually fixes a typing mistake. Old records carrying the wrong number would not match rosters. |
| Level | Off | Usually a promotion. Past classes were genuinely attended at the old level. |

**Rules**

1. Track number must stay unique. The save is refused with a clear message if another student has it.
2. If the student is on a roster, the roster link follows the new number.
3. Every change is written to `profile_edits` (who, what, old value, new value, reason, time). Rows cannot be edited or deleted.
4. PDF reports already generated keep their hash and are not altered. A new report shows the corrected data.
5. The student sees the change on My Records. We recommend also notifying them by email in a later phase.

**Migration `003_admin_edits.sql`**

```sql
create table public.profile_edits (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references public.profiles(id) on delete cascade not null,
  edited_by uuid references public.profiles(id) not null,
  field text not null check (field in ('track_no','level')),
  old_value text,
  new_value text,
  reason text not null,
  applied_to_past_records boolean not null default false,
  created_at timestamptz default now()
);

-- Students cannot change these fields once set. Admins and our trusted functions can.
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role
       or new.lecturer_status is distinct from old.lecturer_status
       or (old.track_no is not null and new.track_no is distinct from old.track_no)
       or (old.level is not null and new.level is distinct from old.level) then
      raise exception 'Only an administrator can change this field';
    end if;
  end if;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute procedure public.guard_profile_update();

create policy "Admin update profiles" on public.profiles for update
  using (public.is_admin());

create view public.my_records with (security_invoker = true) as
  select a.id, a.session_id, s.name as session_name, s.kind, s.host_name,
         s.session_date, a.marked_at
  from public.attendance a join public.sessions s on s.id = a.session_id
  where a.student_id = auth.uid();
```

The edit itself runs through one function `admin_edit_student(student_id, field, new_value, reason, apply_to_past)` marked `security definer`. It checks `is_admin()`, checks track-number uniqueness, updates the profile, optionally updates the attendance snapshots (logging each in `attendance_audit`), and inserts the `profile_edits` row, all in one transaction.

> **Note:** the first save of track number and level during registration is allowed because the old value is empty. After that, only an admin can change them.

---

## 9. Exports

### 9.1 Lecturer CSV

Per class or per single session. Built with papaparse's `unparse` so commas and quotes in names are escaped correctly.

**Columns:** Class, Course Code, Session Date, Full Name, Track No, Level, Faculty, Department, Status, Time Marked, Entry Type

Status is Present or, when a roster exists, Absent. Entry Type is QR or Manual. Prefix cells that start with `=`, `+`, `-` or `@` with a quote so spreadsheet formulas cannot be injected through a student's name.

### 9.2 Lecturer PDF report

Generated in a Next.js route handler (`app/api/reports/[classKey]/pdf/route.ts`, Node runtime) with `@react-pdf/renderer`, using the lecturer's own session so RLS applies. The report is built to be handed to a school office or Head of Department.

| Page | Content |
|---|---|
| Cover | School, faculty, department. Class name and code. Lecturer name. Reporting period. Number of sessions. Date and time generated. Report ID and SHA-256 hash. |
| Summary | Total sessions held. Unique students who attended. Average attendance per session. Highest and lowest attended session with dates. Overall attendance rate (if a roster exists). |
| Statistics | Attendance per session (bar chart). Attendance by department and by level (tables). Trend across sessions (line). Students below 75% flagged in a list (threshold configurable). |
| Student register | Table: No., Full name, Track no., Level, Department, Sessions attended, Percentage. Sorted by name. A tick grid per session when the class has 12 sessions or fewer. |
| Method note | One short paragraph: attendance was recorded by signed, time-limited QR code scanned by authenticated student accounts. Manual entries are counted and listed. |
| Sign-off | Lecturer, HOD, Dean: name, signature and date lines. |

Every page footer shows the Report ID, page x of y, and "Generated by JAV Lite · Blim Technologies". The report is also saved in `reports` with its hash, so a school can ask you to confirm a PDF is genuine.

### 9.3 Admin CSV

Keep the v1 function, with the fixes in Section 12 (JWT check for admin, quoted fields).

---

## 10. Design system additions

Colours from v1 are unchanged (`--primary` `#C41EBB`, `--accent` `#FF9D66`, and so on).

- **Scan button:** 64px circle, `--primary`, white QR icon, raised 20px above the bar, soft glow in `--accent`.
- **QR screen:** always black on white regardless of theme, minimum 280px.
- **Status chips:** Open = `--success`, Ended = `--text-tertiary`, Pending = `--warning`.
- Bottom bar and floating **+** need safe-area padding on phones with gesture bars.

---

## 11. Consent, privacy and terms in the product

The legal text is in Appendices A and B. These rules make it enforceable:

1. **Click to accept, not just "by using".** First sign-in shows an unticked checkbox: "I have read and agree to the Terms and the Privacy Policy" with links. Nothing else is usable until it is ticked.
2. **Record every acceptance** in `consents` (user, document, version, time, user agent, hashed IP). Rows can never be edited or deleted.
3. **Version the documents.** Keep each version at `/legal/privacy/v1`, `/legal/terms/v1` and so on, forever. When a document changes in a way that matters, bump the version and make every user accept again on next sign-in.
4. **Show the notice where it matters:** a short line under the scan button's first-use screen.
5. **Settings page:** download my data, delete my account (request). These are needed for rights under the Nigeria Data Protection Act 2023.
6. **Proof pack for a complaint:** query `consents` by user to show which version of each document they accepted and when, plus the attendance rows and audit log.

---

## 12. Fixes carried over from v1

1. Callback route: move to `app/auth/callback/route.ts` so it matches the `redirectTo` of `/auth/callback`.
2. Use `createServerClient` from `@supabase/ssr` in the callback. Remove `@supabase/auth-helpers-nextjs`.
3. Callback redirect: registered users go to `/home`, others stay on the first-scan flow or `/onboarding` (role choice).
4. Add `.eq('id', user.id)` on every `profiles` query that uses `.single()`. Use `getUser()` on the server, not `getSession()`.
5. Replace recursive RLS with the helper functions in Section 4.1.
6. Edge Function for CSV must check the caller's JWT and role before reading data, quote every field, and use the caller's client rather than the service key where possible.
7. Pick one host. Netlify and Vercel both work; update the stack table, Site URL and redirect lists to match.
8. Return 400 for an invalid `eventId` (v1 testing list required it but the code did not).

---

## 13. Updated file structure

```
jav-lite/
├── app/
│   ├── page.tsx                    ← Landing / sign-in
│   ├── auth/callback/route.ts
│   ├── onboarding/page.tsx         ← Pick role, consent
│   ├── scan/page.tsx               ← Scanner + first-scan form
│   ├── home/page.tsx               ← Student: Classes / Events tabs
│   ├── profile/page.tsx            ← Edit details, delete data
│   ├── lecturer/
│   │   ├── layout.tsx              ← Approved-lecturer guard
│   │   ├── page.tsx                ← My classes + floating +
│   │   ├── new/page.tsx            ← Create class
│   │   ├── session/[id]/page.tsx   ← Live QR screen
│   │   └── class/[key]/page.tsx    ← Sessions, students, reports
│   ├── admin/
│   │   ├── layout.tsx
│   │   ├── page.tsx                ← Students by department
│   │   ├── org/page.tsx            ← Schools, faculties, departments
│   │   ├── rosters/page.tsx
│   │   ├── lecturers/page.tsx      ← Approvals
│   │   ├── events/page.tsx         ← + and event QR
│   │   └── records/[sessionId]/page.tsx
│   ├── legal/privacy/[version]/page.tsx
│   ├── legal/terms/[version]/page.tsx
│   └── api/reports/[classKey]/{csv,pdf}/route.ts
├── components/ (ui/, BottomNav, ScanButton, QrDisplay, QrScanner,
│                SessionCard, StudentCard, ConsentBox)
├── lib/ (supabase/, qr.ts, pdf/, constants.ts)
└── supabase/
    ├── functions/ session-qr, mark-attendance, register-and-mark, export-attendance
    └── migrations/ 001_initial_schema.sql, 002_v2_schema.sql
```

`constants.ts` no longer holds `DEPARTMENTS`; schools, faculties and departments now come from the database.

---

## 14. Build order

| Phase | Build | Done when |
|---|---|---|
| 1 | Foundation: auth fixes, roles, consent gate, org tables | Sign in, accept terms, role routing works |
| 2 | QR core: sessions, `session-qr`, `mark-attendance`, QR display | A test session shows a rotating QR and rejects an old code |
| 3 | Student side: bottom nav, scanner, first-scan form, tabs | New student scans, registers and is marked in one flow |
| 4 | Lecturer side: approval, + button, live screen, class detail | Lecturer starts, ends and reopens a class |
| 5 | Admin: org manager, rosters, events with QR, approvals | Admin creates an event and sees its attendance |
| 6 | Exports: lecturer CSV, PDF report, admin CSV | PDF opens with correct figures and a Report ID |
| 7 | Legal: pages, versioned consent, data download and delete | Consent row exists for every user |

---

## 15. Testing checklist

**Student**

- [ ] Signed-out scan goes to Google and returns to the same code
- [ ] First scan shows the form, with no photo step
- [ ] Second scan only asks for confirmation
- [ ] Scanning a non-JAV QR (a website link, a shop code) is rejected
- [ ] Scanning twice shows "already marked"
- [ ] A screenshot of the QR fails after about a minute
- [ ] Scanning an ended or expired session fails with a clear message

**Lecturer**

- [ ] Pending lecturer cannot create a class
- [ ] Approved lecturer sees only their own classes
- [ ] Live counter rises as students scan
- [ ] End session stops further marks immediately
- [ ] CSV opens in Excel with names containing commas intact
- [ ] PDF totals equal the CSV totals

**Admin**

- [ ] Adding a department makes it appear in the registration dropdown
- [ ] Deleting a department with students is blocked
- [ ] A roster student who registers is linked by track number
- [ ] Non-admin cannot reach `/admin` or call the admin export

**Security and legal**

- [ ] A student cannot change their own role
- [ ] A student cannot read another student's profile or the `qr_secret`
- [ ] Every account has `consents` rows for the current versions
- [ ] Bumping a document version forces re-acceptance

---

## 16. Scope guard (unchanged and extended)

- No face capture, facial recognition or face matching. The app collects no face photos.
- No location tracking in this version. Rotating QR plus authenticated accounts is the proof of presence. (Optional later: a location check for lecturers who want it.)
- No mobile app, responsive web only. The scanner works in mobile browsers.
- No SMS or email notifications.

---

## 17. Security hardening

This section tightens the whole build. Items marked **Must** are required before the first real class uses the app.

### 17.1 Database

| # | Control | Level |
|---|---|---|
| 1 | `enable row level security` and `force row level security` on every table in `public`. A table with RLS off is fully open through the public API. | Must |
| 2 | Remove default access: `revoke all on all tables in schema public from anon, authenticated;` then grant back only what each role needs. The `anon` role gets nothing, since every user signs in first. | Must |
| 3 | Hide the QR secret. Run `revoke select on public.sessions from authenticated;` then `grant select (id, kind, name, course_code, description, host_name, school_id, school_name, created_by, status, rotating, session_date, started_at, expires_at, ended_at) on public.sessions to authenticated;`. `qr_secret` is then unreadable to every logged-in user, and only Edge Functions read it. | Must |
| 4 | Every `security definer` function sets `search_path` and has `revoke execute ... from public` followed by a grant only to `authenticated`. Never put `service_role` logic in a function callable by students. | Must |
| 5 | Views use `security_invoker = true` so they obey the caller's RLS. | Must |
| 6 | Audit tables (`consents`, `profile_edits`, `attendance_audit`, `reports`, `correction_requests`) have no delete policy, and `revoke update, delete` for `authenticated`. | Must |
| 7 | Add unique and check constraints (already in the schema) and foreign keys everywhere. Constraints stop bad data even if code is wrong. | Must |
| 8 | Turn on Supabase point-in-time recovery and test one restore. | Should |
| 9 | Write automated RLS tests (pgTAP or a script with two student accounts, a lecturer and an admin) and run them on every deploy. | Should |

### 17.2 Sign-in and sessions

- Use `supabase.auth.getUser()` on the server for every guard. `getSession()` reads a cookie that can be forged, so never trust it for access decisions.
- `@supabase/ssr` with httpOnly cookies. No tokens in localStorage.
- Use the PKCE flow, an exact-match redirect URL list (no wildcards in production), and only Google as a provider. Turn off email sign-up and anonymous sign-in in Supabase.
- Short JWT expiry (1 hour) with refresh-token rotation on.
- Admins must use a second factor (Supabase TOTP MFA) before the admin area loads. Check the `aal2` level in the admin layout. Keep at least two admins so you never need an emergency database edit.
- Admins bootstrap by SQL only. No screen can make a first admin.
- Lecturer role stays pending until an admin approves. Optional: show the admin a warning when the lecturer's email domain is not the school's.

### 17.3 Edge Functions and the QR system

| Control | Detail |
|---|---|
| Verify identity first | Every function reads the user from the request JWT before anything else. Leave `verify_jwt` on. Never accept a `student_id` from the request body. |
| Validate input | Check every field with a schema (zod): types, lengths, UUID format. Reject unknown fields. |
| Constant-time compare | Compare QR signatures with a constant-time function, not `===`. |
| Single-use tickets | A claim ticket carries a unique id (`jti`) stored on first use, so a stolen ticket cannot be replayed. |
| Rate limits | `claim-session` and `mark-attendance`: at most 10 calls per user per minute (a small `rate_limits` table or Upstash Redis). Return 429. |
| CORS | Allow only your own site origin, not `*`. |
| Errors | Return short generic messages to the client. Log details on the server only, with no personal data in logs. |
| Service-role key | Only inside Edge Function secrets. It must never appear in a variable starting with `NEXT_PUBLIC_`, in the browser, in git, or in a preview build. Rotate it at once if it ever leaks. |
| Anti-sharing flag | If more than 3 different accounts mark attendance from the same hashed IP in one session, flag it for the lecturer to review. It is a flag, not an automatic block, because a lecture hall shares one network. |

### 17.4 Face photos

Not applicable. The app does not collect face photos, so there is no image upload, no Cloudinary account and no signed-upload function. If photos are ever added in a later version, they must use signed uploads and private, time-limited delivery.

### 17.5 Web app

- Security headers in `next.config.ts`: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (and `frame-ancestors 'none'` in CSP), `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), microphone=(), geolocation=()`.
- A Content-Security-Policy that allows only your own scripts, Supabase and Google. Test the QR scanner after adding it.
- Never use `dangerouslySetInnerHTML`. React escapes all text (names, reasons, class titles) by default.
- Escape CSV cells that start with `=`, `+`, `-` or `@` (Section 9.1). Generate PDFs from data fields only, never from raw HTML.
- Protect the route handlers for CSV and PDF with the signed-in user's session, so RLS limits what they can export.
- Keep QR pages and records pages out of search engines (`noindex`) and set `Cache-Control: no-store` on pages with personal data.

### 17.6 Operations

- Separate Supabase projects for development and production. Preview deployments must never point at the production database.
- Store secrets only in the host's and Supabase's secret stores. Turn on GitHub secret scanning and Dependabot. Commit the lockfile, run `npm audit` in CI, and pin exact versions.
- Log sign-ins, admin actions, role changes and failed 403 bursts. Alert on repeated failures. Use an error tracker with personal data scrubbed.
- Breach plan written before launch: contain, assess, notify the NDPC and affected users within 72 hours (as the Privacy Policy promises), record what happened.
- Delete expired data on the schedule in the Privacy Policy (a monthly job).

### 17.7 Security test checklist

Run each as a different user with their own login, directly against the database API and not only through the screens:

1. Student A reads Student B's profile, attendance, or request: all must fail.
2. Student updates their own `role`, `track_no` (after registration), `level`, or `lecturer_status`: must fail.
3. Student reads `sessions.qr_secret`: must fail.
4. Student inserts into `attendance` directly: must fail. Only the function can.
5. Student inserts a correction request with another `student_id`, a resolved status, or a made-up lecturer response: must fail.
6. Student sends 6 requests in an hour: the sixth must fail.
7. Lecturer opens another lecturer's class, report or requests: must fail.
8. Pending lecturer calls create session: must fail.
9. Non-admin calls `admin_edit_student` or reaches `/admin` pages: must fail.
10. An expired ticket, a reused ticket, and a code older than 60 seconds: all rejected.
11. A name like `=HYPERLINK(...)` exported to CSV opens as plain text.
12. A reason containing `<script>` shows as text and runs nothing.
13. A request with no token to any table or function: rejected.

*Appendix A (Privacy Policy) and Appendix B (Terms and Conditions) follow.*

---

# Appendix A — Privacy Policy

**JAV Lite Privacy Policy · Version 1.0 · Effective date: [DD Month YYYY]**

> **Before publishing:** replace every [bracketed] item, and have a Nigerian data-protection lawyer review this text. It is written to match how the app actually works (Sections 1 to 15 of this document). If the app changes, this policy must change with it.

## A1. Who we are

JAV Lite ("the App", "we", "us") is an attendance platform operated by Blim Technologies [registered name, RC number, address, Nigeria]. Contact for privacy matters: [privacy@yourdomain.com]. Data Protection Officer: [name or role, email].

We act in two roles:

- **Data controller** for your account (sign-in, profile, consent records, security logs).
- **Data processor** for attendance records created for a school, lecturer or event organiser. The school or organiser decides why attendance is taken and how the records are used. We store and process them on their behalf.

## A2. What this policy covers

This policy applies to everyone who uses the App: students, lecturers, administrators and event attendees. It is written to meet the Nigeria Data Protection Act 2023 ("NDPA") and the rules of the Nigeria Data Protection Commission ("NDPC").

## A3. Information we collect

| Category | What | How |
|---|---|---|
| Account | Google account email, name and unique ID | When you sign in with Google. We never see your Google password. |
| Profile | Full name, track or ID number, level, school, faculty, department | You type it in the registration form. |
| Lecturer details | Full name, school, approval status | You type it in; an administrator approves it. |
| Attendance records | Class or event name, host name, date, time marked, and a copy of your profile details at that moment | Created when you scan a QR code. |
| Camera access | Live camera feed used to read QR codes | Only while the scanner is open. Camera images from scanning are not stored or sent to us. |
| Technical data | Browser and device type, hashed IP address, time of actions, error logs | Collected automatically for security and troubleshooting. |
| Consent records | Which document and version you accepted, and when | When you tick the acceptance box. |
| Reports and audit logs | Which reports were generated, by whom, manual changes to attendance, and problem reports students send about their own records | Created when lecturers or admins use those functions. |

We do not collect your precise location, contacts, messages, or payment information. We do not use cookies for advertising.

## A4. Face photos

The App does not collect face photos. It has no facial recognition, face matching or biometric identification feature.

## A5. Why we use your information, and our legal basis

| Purpose | Legal basis (NDPA) |
|---|---|
| Create and secure your account; let you sign in | Performance of a contract (the Terms) |
| Record and show your attendance for classes and events | Performance of a contract; and the legitimate interest of your school or organiser in keeping attendance |
| Generate attendance reports for lecturers, schools, Heads of Department and administrators | Legitimate interest of the school or organiser; legal or academic obligations of the school |
| Prevent fake attendance and abuse (rotating QR codes, logs) | Legitimate interest in security and integrity |
| Keep proof of what you accepted | Legal obligation and legitimate interest in defending legal claims |
| Fix bugs and improve the App | Legitimate interest |

We do not sell your data. We do not use it for marketing.

## A6. Who can see your information

| Who | What they can see |
|---|---|
| You | Your own profile, attendance history and consent records |
| Lecturers | Names, track numbers, levels, departments and attendance times of students who marked attendance in their own classes. |
| Administrators of your school or the organiser | All registered students, their profiles and attendance for sessions in their organisation |
| Schools and HODs | Reports that a lecturer generates and submits (names, track numbers, attendance, statistics) |
| Other students | Nothing. Students cannot see each other's data. |
| Blim Technologies staff | Only as needed for support, security and legal compliance, under confidentiality duties |

## A7. Service providers we use

We share data with trusted providers who process it for us under contract:

| Provider | Purpose | Data involved |
|---|---|---|
| Supabase | Database, authentication, serverless functions | All account, profile, attendance and log data |
| Google | "Sign in with Google" | Email, name, Google ID |
| [Netlify or Vercel] | Hosting the website | Technical request data |

Some of these providers store data outside Nigeria. Where data is transferred abroad we rely on contractual safeguards and providers that apply appropriate data-protection standards, as the NDPA requires.

We may also disclose information when required by law, a court order, or a lawful request from a regulator or law-enforcement authority, and to protect rights and safety.

## A8. How long we keep it

| Data | Retention |
|---|---|
| Account and profile | While your account is active, plus [12] months |
| Attendance records and reports | As set by the school or organiser, and by default for [5] academic years, because schools may need them for audits and results disputes |
| Consent records and audit logs | [6] years after your account closes, to prove what was accepted and done |
| Security and technical logs | [12] months |

When the period ends we delete or anonymise the data.

## A9. Security

We use HTTPS, row-level access controls so users only reach data they are allowed to see, short-lived signed QR codes, server-side checks on every attendance mark, and limited staff access. No system is perfectly secure. If a breach likely puts you at risk, we will notify you and the NDPC within 72 hours of becoming aware, as the law requires.

## A10. Your rights

Under the NDPA you may:

1. Access the personal data we hold about you and get a copy.
2. Correct inaccurate data (your name can be edited in your profile; your track number and level are corrected by an administrator on request; attendance snapshots are corrected by the lecturer or admin through an audited change).
3. Delete your data, subject to Section A8 and legal duties.
4. Restrict or object to processing based on legitimate interest.
5. Data portability: get your data in a common format (CSV or JSON).
6. Not be subject to purely automated decisions with legal effect on you. The App makes none.
7. Complain to the Nigeria Data Protection Commission.

To use these rights, use the settings page in the App or email [privacy@yourdomain.com]. We will answer within [30] days. We may need to confirm your identity first. Some attendance records belong to the school's academic records; in that case we will refer your request to the school as well.

## A11. Children and minors

The App is intended for students at tertiary institutions and adult event attendees. If you are under 18, you may use the App only with the consent and supervision of a parent or guardian, or where your school lawfully requires attendance recording. If we learn we hold a child's data without proper authority, we will delete it.

## A12. Camera permission

The App asks your browser for camera permission to scan QR codes. You can refuse or revoke this in your browser settings; you will then be unable to scan, and a lecturer or admin would need to add you manually.

## A13. Cookies and local storage

We use only what is needed to keep you signed in and secure. We do not use advertising or cross-site tracking cookies.

## A14. Changes to this policy

We publish every version at its own permanent address. If we change the policy in a way that affects you, we will ask you to accept the new version the next time you sign in. Earlier versions and the date you accepted them stay on record.

## A15. Contact and complaints

Privacy questions: [privacy@yourdomain.com]. Postal address: [address]. You may also complain to the Nigeria Data Protection Commission at [ndpc.gov.ng].

---

# Appendix B — Terms and Conditions

**JAV Lite Terms and Conditions · Version 1.0 · Effective date: [DD Month YYYY]**

> **Before publishing:** fill in the [brackets] and have a Nigerian lawyer review. These Terms are the document users accept, so each rule below matches a feature in this build.

## B1. Agreement

These Terms are a binding agreement between you and Blim Technologies [registered name, RC number] ("Blim", "we", "us") about your use of JAV Lite ("the App"). By ticking the acceptance box, signing in, or scanning a QR code, you confirm that you have read and agree to these Terms and to the Privacy Policy. If you do not agree, do not use the App.

Your acceptance is recorded with the version of each document, the date and time, and technical details (Section B14).

## B2. What the App does

JAV Lite lets lecturers and administrators open attendance sessions (classes and events), display a QR code, and record which signed-in users scanned it. It produces lists, CSV files and PDF reports. The App records that an account scanned a code. It does not verify who is physically holding the phone, and it does not use facial recognition.

## B3. Who may use it

- You must be able to form a binding contract, or have the permission of a parent or guardian if you are under 18.
- You need a valid Google account.
- Students register with their real name and real track or ID number.
- Lecturers must be genuinely employed or authorised by the school they name, and must wait for administrator approval.
- Administrators act for their school or organisation and are responsible for what they do in the App.

## B4. Your account

You are responsible for everything done through your account and for keeping your Google sign-in secure. Tell us at once if you think someone else has used it. Do not share your account, and do not use anyone else's.

## B5. Rules for all users

You must not:

1. Give false names, track numbers, schools, or other details.
2. Mark attendance for another person, or ask or let someone mark it for you.
3. Share, photograph, forward or post a QR code so that someone who is not present can scan it.
4. Scan a code for a session you are not attending.
5. Attempt to bypass, test, or break the App's security, including rotating codes, expiry times and access controls.
6. Use bots, scripts, or automated tools against the App.
7. Use the App to harass, track, or profile other people, or to collect personal data you are not entitled to.
8. Copy, resell, or reverse engineer the App, except as the law allows, and must not try to defeat the view-only protection on records pages or scrape data from the App.

## B6. Student responsibilities

- Attendance is recorded only if you scan the code while the session is open. Scan while the QR is on display.
- Check the success screen. If it did not appear, tell the lecturer before you leave. Late claims cannot always be honoured.
- Phone, camera, battery or network problems on your side do not make us or the lecturer liable for a missing record, but a lecturer or admin may add you manually at their discretion.
- Dishonest attendance may be a breach of your school's discipline rules. We may report it to the school.

## B7. Lecturer and administrator responsibilities

- You are responsible for the classes and events you create, and for ending sessions or letting them expire.
- You must not display codes for sessions you are not running, and must not change records except to correct genuine errors. Manual changes are logged with your name and time, and marked in reports.
- You must handle exported CSV files and PDF reports as confidential. Use them only for your school's lawful academic and administrative purposes, and store and share them securely.
- Reports you submit to a school or HOD are your own submissions. You must check them for accuracy before sending.
- Administrators must keep department lists, rosters and lecturer approvals accurate, and must not approve people they cannot confirm.

## B8. Attendance records and reports

Attendance records and reports are generated from the information stored in the App at the moment of generation. Each PDF has a Report ID and a hash. A report that has been edited after generation will not match. We provide the data as recorded; the school or organiser, not Blim, decides what the records mean and what action follows (for example, eligibility for exams, marks or sanctions).

## B9. No face photos

The App does not collect face photos and does not use facial recognition.

## B10. Your content and our rights

You keep ownership of what you submit (such as your profile details). You give us a limited, non-exclusive licence to store, display and process it only to run the App for you and your school. The App, its design, code, name and logos belong to Blim Technologies and its licensors. We grant you a personal, limited, non-transferable right to use the App as these Terms allow.

## B11. Availability

We work to keep the App running but do not promise it will be uninterrupted or error-free. It may be unavailable for maintenance, outages of our providers (Supabase, Google, hosting), network faults, or events outside our control. QR scanning needs a working camera, a modern browser and internet access. We may change, suspend or discontinue features with reasonable notice where possible.

## B12. Suspension and ending

We or your school may suspend or close an account, and invalidate disputed attendance, if you break these Terms, endanger the App or other users, or the school asks us to. You may stop using the App and request deletion of your account at any time (subject to the retention periods in the Privacy Policy).

## B13. Limits of liability

To the fullest extent the law allows:

- The App is provided "as is" and "as available".
- Blim is not liable for indirect or consequential loss, including lost marks, missed exam eligibility, disciplinary outcomes, or lost opportunities, arising from attendance records, errors, downtime or decisions made by schools or lecturers.
- Blim's total liability to you for any claim connected with the App is limited to [amount, for example the fees you paid in the last 12 months, or NGN 50,000 if the App was free to you].
- Nothing in these Terms excludes liability that cannot be excluded by law, such as for fraud or for death or personal injury caused by negligence.

You agree to compensate Blim for loss caused by your breach of these Terms, for example from deliberately false attendance or misuse of data.

## B14. Records of acceptance

When you accept these Terms and the Privacy Policy, we record: your account, which document and version you accepted, the date and time, your browser details, and a hashed form of your IP address. We keep this record so that, if a dispute arises, we and the school can show exactly what you agreed to. You will be asked to accept again when a document changes in a way that matters.

## B15. Changes

We may update these Terms. Each version is kept at its own permanent address. If you keep using the App after being shown a new version and accepting it, the new version applies from then on. Material changes will not apply to you until you accept them.

## B16. Disputes and governing law

These Terms are governed by the laws of the Federal Republic of Nigeria. Please contact [support@yourdomain.com] first so we can try to resolve a complaint within [30] days. If it is not resolved, the parties will try mediation in [city, state] before going to court. The courts of [state] have jurisdiction, except where the law gives you the right to go elsewhere.

## B17. General

- If a part of these Terms is found invalid, the rest stays in force.
- Our not enforcing a right is not a waiver of it.
- You may not transfer your rights under these Terms. We may transfer ours as part of a sale or restructuring of our business.
- These Terms and the Privacy Policy are the whole agreement between you and us about the App.

## B18. Contact

Blim Technologies, [address], Nigeria · [support@yourdomain.com] · Privacy: [privacy@yourdomain.com]

---

# Appendix C — Implementation Notes for the Legal Pages

| Task | How |
|---|---|
| Public pages | `/legal/privacy/v1` and `/legal/terms/v1`, plus `/privacy` and `/terms` redirecting to the latest version |
| Version constant | `CURRENT_PRIVACY_VERSION = '1.0'` and `CURRENT_TERMS_VERSION = '1.0'` in `lib/constants.ts` |
| Gate | Middleware checks `consents` for the current versions after sign-in. Missing means redirect to `/onboarding` |
| Acceptance insert | One Edge Function writes both consent rows together with user agent and salted IP hash |
| Proof pack | Admin-only query by user: consent rows, attendance rows, audit log |
| Data download | Profile page button returns the user's profile, attendance and consents as JSON or CSV |
| Deletion | Request button creates a task; anonymise profile, keep consent and audit rows for the retention period |
| Footer | Links to both documents on every page, and on the scanner and registration screens |

*End of document.*