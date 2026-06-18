# JAV LITE — Attendance System Build Document
**Version 1.0 · Blim Technologies**
Stack: Next.js 14 · Supabase · Cloudinary · Google OAuth · Edge Functions

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Tech Stack & Architecture](#2-tech-stack--architecture)
3. [Database Schema](#3-database-schema-supabase)
4. [Project File Structure](#4-project-file-structure)
5. [Phase 1 — Foundation](#5-phase-1--foundation)
6. [Phase 2 — Student Registration](#6-phase-2--student-registration)
7. [Phase 3 — Attendance Marking](#7-phase-3--attendance-marking)
8. [Phase 4 — Admin Dashboard](#8-phase-4--admin-dashboard)
9. [Phase 5 — CSV Export via Edge Function](#9-phase-5--csv-export-via-edge-function)
10. [Colour & Design System](#10-colour--design-system)
11. [Key Component Specifications](#11-key-component-specifications)
12. [End-to-End Testing Checklist](#12-end-to-end-testing-checklist)
13. [Deployment](#13-deployment)
14. [Quick Reference](#14-quick-reference)

---

## 1. Project Overview

JAV Lite is a lightweight, activity-oriented attendance management system. Unlike the full JAV platform, JAV Lite is built to serve any event or activity — not just university classes — making it suitable for conferences, workshops, community meetups, corporate training, and more.

The product has two sides:

- **Student Side** — Self-register via Google, capture a face photo, mark attendance at events.
- **Admin Side** — View all students by department with face photos, manage events, and export CSV reports.

> ⚠️ JAV Lite is intentionally stateless on the client — all data lives in Supabase. This makes it resumable and multi-device from day one.

### 1.1 Core User Flows

**Student Flow:**

1. Land on the site
2. Click **Sign in with Google**
3. First-time users are redirected to the registration form
4. Fill in: Full Name, Track/ID Number, Level, Department
5. Camera opens — student takes a face photo
6. Photo uploads to Cloudinary; the URL is stored in Supabase
7. Registration complete — student is redirected to the Attend page
8. On the Attend page, student sees the active event and clicks **Attend** to mark presence

**Admin Flow:**

1. Admin signs in with Google (`is_admin` flag set in DB)
2. Lands on Admin Dashboard
3. Views all students organised by department, each showing their Cloudinary face photo
4. Manages events: create, activate, close
5. Views per-event attendance with present/absent status for every student
6. Exports attendance to CSV — by a single department or all departments at once

### 1.2 What JAV Lite is NOT (Scope Guard)

- There is no facial recognition or face-matching logic in this version.
- Attendance is self-marked (student clicks Attend). Face photo is for admin identity verification only.
- No mobile app — responsive web only.
- No SMS or email notifications in this phase.

---

## 2. Tech Stack & Architecture

| Layer | Technology | Why |
|---|---|---|
| Frontend | Next.js 14 (App Router) | SSR, API routes, familiar to the team |
| Styling | CSS Variables (provided theme) | Consistent brand, no extra dependency |
| Auth | Supabase Auth + Google OAuth | One-click sign-in, session managed automatically |
| Database | Supabase PostgreSQL | Relational, RLS policies, real-time if needed |
| File Storage | Cloudinary | Face photo hosting, transformation API, CDN delivery |
| Backend Logic | Supabase Edge Functions (Deno) | Serverless, runs close to DB, no cold starts |
| CSV Export | Edge Function + papaparse | Stream large datasets without blocking the client |
| Deployment | netlify (frontend) + Supabase (backend) | Standard Next.js + Supabase pairing |

### 2.1 Architecture Diagram

```
Browser  →  Next.js App  →  Supabase Auth  →  PostgreSQL + RLS
Browser  →  Cloudinary Upload Widget  →  Cloudinary CDN  (URL stored in DB)
Admin    →  Next.js API route / Edge Function  →  CSV stream  →  Download
```

### 2.2 Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=jav_lite_faces
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-oauth-client-id
```

> ⚠️ Never commit `.env.local` to git. Add it to `.gitignore` immediately after project init.

---

## 3. Database Schema (Supabase)

All tables are created in the `public` schema. Run these as SQL migrations in the Supabase dashboard under **Database > SQL Editor**.

### 3.1 Table: profiles

Extends `auth.users`. Created automatically on first Google sign-in via a trigger.

```sql
create table public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  email       text unique not null,
  full_name   text,
  track_no    text unique,
  level       text,
  department  text,
  photo_url   text,
  is_admin    boolean default false,
  registered  boolean default false,
  created_at  timestamptz default now()
);
```

> ✓ The `registered` flag distinguishes users who have completed the registration form from those who only signed in with Google.

### 3.2 Table: events

```sql
create table public.events (
  id          uuid default gen_random_uuid() primary key,
  name        text not null,
  description text,
  date        date not null,
  is_active   boolean default true,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz default now()
);
```

### 3.3 Table: attendance

```sql
create table public.attendance (
  id         uuid default gen_random_uuid() primary key,
  event_id   uuid references public.events(id) on delete cascade not null,
  student_id uuid references public.profiles(id) on delete cascade not null,
  marked_at  timestamptz default now(),
  unique(event_id, student_id)
);
```

> ⚠️ The `unique` constraint on `(event_id, student_id)` prevents a student from marking attendance twice for the same event.

### 3.4 Trigger: auto-create profile on signup

```sql
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

### 3.5 Row Level Security (RLS)

Enable RLS on all tables. These are the minimum required policies:

**profiles table:**

```sql
alter table public.profiles enable row level security;

-- Users can read their own profile
create policy "Self read" on public.profiles for select using (auth.uid() = id);

-- Users can update their own profile
create policy "Self update" on public.profiles for update using (auth.uid() = id);

-- Admins can read all profiles
create policy "Admin read all" on public.profiles for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));
```

**events table:**

```sql
alter table public.events enable row level security;

-- Everyone can read events
create policy "Public read" on public.events for select using (true);

-- Only admins can insert/update/delete
create policy "Admin write" on public.events for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));
```

**attendance table:**

```sql
alter table public.attendance enable row level security;

-- Students can insert their own attendance
create policy "Student mark" on public.attendance for insert
  with check (auth.uid() = student_id);

-- Admins can read all attendance
create policy "Admin read" on public.attendance for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));
```

---

## 4. Project File Structure

```
jav-lite/
├── app/
│   ├── layout.tsx                  ← Root layout with fonts + providers
│   ├── page.tsx                    ← Landing / sign-in page
│   ├── (auth)/
│   │   └── callback/route.ts       ← Google OAuth callback handler
│   ├── register/
│   │   └── page.tsx                ← Student registration form + face capture
│   ├── attend/
│   │   └── page.tsx                ← Active event + mark attendance button
│   └── admin/
│       ├── layout.tsx              ← Admin auth guard
│       ├── page.tsx                ← Admin dashboard (students by dept)
│       ├── events/
│       │   └── page.tsx            ← Create / manage events
│       └── records/
│           └── [eventId]/page.tsx  ← Per-event attendance report + CSV export
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Badge.tsx
│   │   └── Avatar.tsx
│   ├── FaceCapture.tsx             ← Webcam + Cloudinary upload widget
│   ├── StudentCard.tsx             ← Card used in admin dept view
│   └── AttendanceRow.tsx           ← Row used in records table
├── lib/
│   ├── supabase/
│   │   ├── client.ts               ← Browser Supabase client
│   │   └── server.ts               ← Server-side Supabase client (cookies)
│   ├── cloudinary.ts               ← Upload helper
│   └── constants.ts                ← Departments, levels, etc.
├── styles/
│   └── globals.css                 ← Full CSS variable theme (provided)
├── supabase/
│   ├── functions/
│   │   └── export-attendance/
│   │       └── index.ts            ← Edge function: CSV export
│   └── migrations/
│       └── 001_initial_schema.sql  ← All tables, triggers, RLS
├── .env.local
├── next.config.ts
└── package.json
```

---

## 5. Phase 1 — Foundation

**Goal:** Working Next.js app with Google sign-in, Supabase connected, routing in place, theme applied.

### 5.1 Initialise the Project

```bash
npx create-next-app@latest jav-lite --typescript --tailwind false --eslint --app
npm install @supabase/supabase-js @supabase/ssr
npm install papaparse && npm install --save-dev @types/papaparse
```

For Cloudinary, add the Upload Widget script tag to `app/layout.tsx`:

```html
<script src="https://upload-widget.cloudinary.com/global/all.js" async />
```

Then paste the provided CSS variables into `styles/globals.css`. Remove all Tailwind directives.

### 5.2 Configure Supabase Auth with Google

1. Go to **Supabase Dashboard > Authentication > Providers > Google** and enable it.
2. In **Google Cloud Console**, create an OAuth 2.0 Client. Set the Authorised redirect URI to:
   ```
   https://<your-supabase-project>.supabase.co/auth/v1/callback
   ```
3. Paste the Client ID and Client Secret back into Supabase.
4. In **Supabase > Auth > URL Configuration**, set Site URL to your Vercel URL (or `localhost:3000` for dev).
5. Add the callback route at `app/(auth)/callback/route.ts`:

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    await supabase.auth.exchangeCodeForSession(code)
  }
  return NextResponse.redirect(new URL('/register', request.url))
}
```

### 5.3 Landing Page Logic (app/page.tsx)

The landing page has one job: show the JAV Lite brand and a Sign in with Google button.

- If signed in AND registered → redirect to `/attend`
- If signed in but NOT registered → redirect to `/register`
- If not signed in → show the sign-in button

```typescript
const { data: { session } } = await supabase.auth.getSession()
if (session) {
  const { data: profile } = await supabase.from('profiles').select('registered').single()
  if (profile?.registered) redirect('/attend')
  else redirect('/register')
}
```

**Sign-in button handler:**

```typescript
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: `${location.origin}/auth/callback` }
})
```

### 5.4 Phase 1 Completion Checklist

- [ ] Next.js project runs on `localhost:3000`
- [ ] CSS theme variables are applied globally
- [ ] Clicking Sign in with Google redirects to Google and returns to `/auth/callback`
- [ ] Callback creates a `profiles` row in Supabase via the trigger
- [ ] Routing logic redirects correctly based on session and `registered` flag

---

## 6. Phase 2 — Student Registration

**Goal:** Signed-in user completes their profile: name, track number, level, department, and face photo uploaded to Cloudinary.

### 6.1 Registration Form Fields

| Field | Input Type | Validation |
|---|---|---|
| Full Name | text input | Required, min 2 characters |
| Track / ID Number | text input (monospace) | Required, unique — checked against DB on blur |
| Level | select | Required — 100, 200, 300, 400, 500 |
| Department | select | Required — from DEPARTMENTS constant |
| Face Photo | Cloudinary Upload Widget | Required — must have a URL before submit |

### 6.2 Face Capture with Cloudinary

Use the Cloudinary Upload Widget with an **unsigned** upload preset. This avoids exposing API secrets on the client.

**Cloudinary Setup:**
In your Cloudinary dashboard, create an Upload Preset named `jav_lite_faces`. Set it to **Unsigned**. Optionally set the folder to `jav-lite/faces`.

**FaceCapture component — widget initialisation:**

```typescript
const widget = (window as any).cloudinary.createUploadWidget({
  cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
  sources: ['camera', 'local'],
  cropping: true,
  croppingAspectRatio: 1,
  maxFiles: 1,
  resourceType: 'image',
}, (error: any, result: any) => {
  if (result.event === 'success') {
    onUpload(result.info.secure_url)
  }
})
widget.open()
```

> ✓ Set `cropping: true` and `croppingAspectRatio: 1` so all face photos are square — consistent in the admin view.

### 6.3 Saving the Registration

On form submit, update the profile row in Supabase:

```typescript
const { error } = await supabase.from('profiles').update({
  full_name:  form.fullName,
  track_no:   form.trackNo,
  level:      form.level,
  department: form.department,
  photo_url:  cloudinaryUrl,
  registered: true
}).eq('id', session.user.id)

if (!error) router.push('/attend')
```

> ⚠️ Check that `track_no` is unique before saving. Query the DB first — if a row with that track number already exists and does not belong to this user, show an error.

### 6.4 Phase 2 Completion Checklist

- [ ] Registration form renders with all four fields
- [ ] FaceCapture component opens Cloudinary widget in camera mode
- [ ] Cloudinary photo URL is stored in state after upload
- [ ] Form submit is disabled until all fields and photo are present
- [ ] Successful submission sets `registered: true` and redirects to `/attend`
- [ ] Profile row in Supabase is fully populated

---

## 7. Phase 3 — Attendance Marking

**Goal:** Registered students can see the active event and mark themselves as present with one click.

### 7.1 Attend Page (app/attend/page.tsx)

This page must:

- Fetch the currently active event (`is_active = true`) from Supabase
- Check if the student has already marked attendance for that event
- Show a prominent Attend button if not yet marked
- Show a confirmation state if already marked
- Show a friendly message if no event is currently active

```typescript
const { data: activeEvent } = await supabase
  .from('events')
  .select('*')
  .eq('is_active', true)
  .single()

const { data: existing } = await supabase
  .from('attendance')
  .select('id')
  .eq('event_id', activeEvent.id)
  .eq('student_id', session.user.id)
  .single()

const alreadyMarked = !!existing
```

### 7.2 Mark Attendance

```typescript
const markAttendance = async () => {
  const { error } = await supabase.from('attendance').insert({
    event_id:   activeEvent.id,
    student_id: session.user.id
  })
  if (!error) setMarked(true)
}
```

> ✓ The `unique` constraint on `(event_id, student_id)` handles race conditions server-side. A `23505` Postgres error means the student already marked — show the confirmed state.

### 7.3 Page States

| State | What to Show |
|---|---|
| No active event | Empty state: "No event is currently active. Check back later." |
| Active event, not marked | Event name, date, description — large Attend button in `--primary` colour |
| Active event, already marked | Green confirmation: tick icon, event name, time marked |
| Loading | Skeleton card while fetching |

### 7.4 Phase 3 Completion Checklist

- [ ] Attend page fetches and displays the active event
- [ ] Attend button inserts a row into the `attendance` table
- [ ] Duplicate marking is blocked (unique constraint + UI guard)
- [ ] Page shows correct confirmation state after marking
- [ ] Unauthenticated or unregistered users are redirected away

---

## 8. Phase 4 — Admin Dashboard

**Goal:** Admins see all students by department with face photos, manage events, and view attendance per event.

### 8.1 Admin Guard (app/admin/layout.tsx)

Every page under `/admin` must verify the user is signed in AND has `is_admin = true`. Redirect to `/` otherwise.

```typescript
const { data: profile } = await supabase
  .from('profiles').select('is_admin').single()
if (!profile?.is_admin) redirect('/')
```

> ✓ To make the first admin: after signing in, run `UPDATE public.profiles SET is_admin = true WHERE email = 'your@email.com'` in the Supabase SQL Editor.

### 8.2 Dashboard — Students by Department

Fetch all registered students and group by department:

```typescript
const { data: students } = await supabase
  .from('profiles')
  .select('id, full_name, track_no, level, department, photo_url')
  .eq('registered', true)
  .order('department, full_name')

const byDept = students.reduce((acc, s) => {
  if (!acc[s.department]) acc[s.department] = []
  acc[s.department].push(s)
  return acc
}, {} as Record<string, typeof students>)
```

Render each department as a labelled section with a grid of student cards:

- **Card contents:** Face photo from Cloudinary URL, full name, track number, level badge.
- **Photo fallback:** If `photo_url` is null, show an Avatar with colour-seeded initials.
- **Department header:** Department name + count badge (e.g. `Computer Science — 12 students`).

### 8.3 Events Management (app/admin/events/page.tsx)

| Action | Implementation |
|---|---|
| Create event | Form: name, description, date. Insert into `events`. Only one event should be active at a time. |
| Activate event | Set `is_active = true` on chosen event. Set `is_active = false` on all others. |
| Close event | Set `is_active = false`. Event moves to records. |
| Delete event | Hard delete. Cascade deletes `attendance` rows automatically. |

> ⚠️ Wrap the activation logic in an Edge Function that first sets all events to `is_active = false` before activating the target. This prevents a race condition from the client.

### 8.4 Attendance Records (app/admin/records/[eventId]/page.tsx)

Fetch all registered students and join with attendance to determine present/absent:

```typescript
const { data: students } = await supabase
  .from('profiles').select('id, full_name, track_no, department, level')
  .eq('registered', true)

const { data: attendees } = await supabase
  .from('attendance').select('student_id, marked_at')
  .eq('event_id', params.eventId)

const attendeeIds = new Set(attendees.map(a => a.student_id))

const rows = students.map(s => ({
  ...s,
  present:  attendeeIds.has(s.id),
  markedAt: attendees.find(a => a.student_id === s.id)?.marked_at ?? null
}))
```

Display as a filterable table with a department dropdown and a `Present / Absent` status column.

### 8.5 Phase 4 Completion Checklist

- [ ] Admin route is protected — non-admins are redirected
- [ ] Dashboard shows students grouped by department with face photos
- [ ] Events page lets admin create, activate, and close events
- [ ] Records page shows full present/absent list for any event
- [ ] Department filter works on the records table

---

## 9. Phase 5 — CSV Export via Edge Function

**Goal:** Admin can export attendance for any event as a CSV file — filtered by department or all departments at once.

### 9.1 Why an Edge Function?

The CSV export queries the database using the service role key to bypass RLS. This key must never be exposed to the browser — an Edge Function keeps it server-side only.

### 9.2 Edge Function: export-attendance

**File:** `supabase/functions/export-attendance/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { eventId, department } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Fetch students (optionally filtered by dept)
  let query = supabase.from('profiles')
    .select('id, full_name, track_no, department, level')
    .eq('registered', true)

  if (department && department !== 'All') {
    query = query.eq('department', department)
  }

  const { data: students } = await query.order('department, full_name')

  // Fetch attendance for this event
  const { data: attendance } = await supabase
    .from('attendance').select('student_id, marked_at')
    .eq('event_id', eventId)

  const ids = new Set(attendance.map(a => a.student_id))

  // Build CSV
  const header = 'Full Name,Track No,Department,Level,Status,Time Marked'
  const rows = students.map(s => {
    const present = ids.has(s.id)
    const time = attendance.find(a => a.student_id === s.id)?.marked_at ?? ''
    return `${s.full_name},${s.track_no},${s.department},${s.level},${present ? 'Present' : 'Absent'},${time}`
  })

  const csv = [header, ...rows].join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="attendance-${eventId}.csv"`
    }
  })
})
```

### 9.3 Calling the Edge Function from the Admin UI

```typescript
const res = await supabase.functions.invoke('export-attendance', {
  body: { eventId: selectedEventId, department: selectedDept }
})
const blob = await res.data
const url = URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url
a.download = `attendance-${selectedEventId}.csv`
a.click()
```

### 9.4 Deploy the Edge Function

```bash
npm install -g supabase
supabase link --project-ref your-project-ref
supabase functions deploy export-attendance
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-key
```

### 9.5 CSV Export UI

Add an Export section on the records page:

- **Department dropdown:** All Departments + each department that has students
- **Export button:** Triggers the Edge Function call and downloads the file
- **File name pattern:** `attendance-{eventName}-{date}-{dept}.csv`

> ✓ Show a loading spinner on the Export button while the function runs — large CSVs can take 1–3 seconds.

### 9.6 Phase 5 Completion Checklist

- [ ] Edge function deploys without errors
- [ ] Export returns correct CSV with `Present/Absent` column
- [ ] Department filter narrows the CSV rows correctly
- [ ] All departments export includes every registered student
- [ ] File downloads with a sensible filename

---

## 10. Colour & Design System

| Variable | Value | Use |
|---|---|---|
| `--primary` | `#C41EBB` | Buttons, active states, links, accents |
| `--accent` | `#FF9D66` | Secondary highlights, hover glows |
| `--bg-primary` | `#FFFFFF` | Page background |
| `--bg-secondary` | `#EDEDEE` | Cards, input backgrounds |
| `--bg-tertiary` | `#DBDBDB` | Borders, dividers |
| `--text-primary` | `#0A0A0A` | All body text |
| `--text-secondary` | `#525252` | Labels, subtitles |
| `--text-tertiary` | `#737373` | Placeholders, metadata |
| `--success` | `#10B981` | Confirmation states (attendance marked) |
| `--error` | `#EF4444` | Validation errors |
| `--warning` | `#F59E0B` | Caution messages |
| `--info` | `#3B82F6` | Info badges, tooltips |

### 10.1 Component Conventions

- **Buttons:** Primary = `background: var(--primary)`, white text. Secondary = `border: 1px solid var(--border)`, transparent background.
- **Inputs:** `background: var(--bg-secondary)`, `border: var(--border)`, focus → `border-color: var(--primary)` with `box-shadow: 0 0 0 3px rgba(196,30,187,.12)`.
- **Cards:** `background: var(--bg-primary)`, `border: 1px solid var(--border)`, `border-radius: var(--radius-lg)`, `box-shadow: var(--shadow-sm)`.
- **Face avatar:** Circle, `object-fit: cover`, `border: 2px solid var(--primary)`.

---

## 11. Key Component Specifications

### 11.1 FaceCapture.tsx

| Prop | Type | Description |
|---|---|---|
| `onUpload` | `(url: string) => void` | Called with the Cloudinary `secure_url` after a successful upload |
| `currentUrl` | `string \| null` | If set, shows a preview of the already-uploaded photo |

States: `idle` → `widget open` → `uploading` → `success (shows preview)` | `error`

### 11.2 StudentCard.tsx

| Prop | Type | Description |
|---|---|---|
| `student` | `Profile` | Full profile object from Supabase |
| `onClick` | `() => void` | Optional — opens a detail modal |

Renders: face photo (from `photo_url` or initials fallback), full name, track number, level badge.

### 11.3 AttendanceRow.tsx

| Prop | Type | Description |
|---|---|---|
| `student` | `Profile` | Student profile data |
| `present` | `boolean` | Whether this student attended |
| `markedAt` | `string \| null` | ISO timestamp of when they marked, or null |

### 11.4 constants.ts

```typescript
export const DEPARTMENTS = [
  'Computer Science',
  'Engineering',
  'Business Administration',
  'Medicine',
  'Law',
  'Architecture'
]

export const LEVELS = ['100', '200', '300', '400', '500']
```

> ✓ Centralise `DEPARTMENTS` and `LEVELS` here so any changes propagate automatically to all dropdowns and filters.

---

## 12. End-to-End Testing Checklist

### 12.1 Student Journeys

1. New user signs in with Google → profile row is created → redirected to `/register`
2. User completes form → Cloudinary upload succeeds → `registered: true` is set → lands on `/attend`
3. User returns to site → already signed in and registered → goes straight to `/attend`
4. User clicks Attend on an active event → attendance row inserted → confirmation shown
5. User tries to click Attend again → button is disabled or shows "Already marked"
6. No active event exists → attend page shows empty state message

### 12.2 Admin Journeys

1. Non-admin signed-in user tries `/admin` → redirected to `/`
2. Admin views dashboard → students appear grouped by department
3. Admin creates an event and activates it → `is_active = true` in DB → students can mark
4. Admin closes event → students can no longer mark
5. Admin views records for event → sees full present/absent list
6. Admin exports CSV for one department → file downloads with correct rows
7. Admin exports CSV for all departments → file contains all students

### 12.3 Edge Cases

- Student with duplicate `track_no` is blocked at form validation
- Cloudinary upload fails → error message shown, submit still disabled
- Supabase RLS blocks a student from reading another student's profile
- Edge function called with invalid `eventId` → returns 400 with error message

---

## 13. Deployment

### 13.1 Supabase

1. Go to [supabase.com](https://supabase.com), create a new project. Note the project URL and anon key.
2. In SQL Editor, run `supabase/migrations/001_initial_schema.sql` in full.
3. Enable Google Auth: **Authentication > Providers > Google**. Paste Client ID and Secret.
4. Deploy Edge Functions: `supabase functions deploy export-attendance`
5. Set secrets: `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=xxx`

### 13.2 Cloudinary

1. Create account at [cloudinary.com](https://cloudinary.com) — free tier is sufficient for a pilot.
2. Create upload preset: **Settings > Upload > Add upload preset**. Name: `jav_lite_faces`. Mode: **Unsigned**.
3. Note your Cloud Name from the Dashboard — goes into `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`.

### 13.3 Vercel

1. Push to GitHub, import on [vercel.com](https://vercel.com).
2. Add all variables from `.env.local` to Vercel's Environment Variables.
3. Update Supabase redirect URLs: add your Vercel URL to **Auth > URL Configuration > Redirect URLs**.
4. Update Google OAuth: add the Vercel URL to **Authorised redirect URIs** in Google Cloud Console.
5. Vercel auto-deploys on every push to `main`.

---

## 14. Quick Reference

### 14.1 Phase Summary

| Phase | What Gets Built | Completion Signal |
|---|---|---|
| 1 — Foundation | Project init, Google auth, routing, theme | Sign in with Google works end-to-end |
| 2 — Registration | Profile form + Cloudinary face upload | Profile row fully populated in Supabase |
| 3 — Attendance | Attend page, mark attendance, confirmation | Attendance row created on button click |
| 4 — Admin | Dashboard, events management, records view | Admin sees all students + attendance table |
| 5 — Export | Edge function, CSV download by dept | CSV file downloads with correct data |

### 14.2 Key Supabase Queries at a Glance

| Task | Query Pattern |
|---|---|
| Get current user profile | `.from('profiles').select('*').eq('id', session.user.id).single()` |
| Get active event | `.from('events').select('*').eq('is_active', true).single()` |
| Check if attended | `.from('attendance').select('id').eq('event_id', eid).eq('student_id', uid).single()` |
| Mark attendance | `.from('attendance').insert({ event_id, student_id })` |
| All students by dept | `.from('profiles').select('*').eq('registered', true).order('department, full_name')` |
| Event attendance | `.from('attendance').select('student_id, marked_at').eq('event_id', eid)` |

---

*JAV Lite — Build Document · Blim Technologies*
