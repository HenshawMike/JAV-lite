-- Initial schema for JAV Lite Attendance System

-- Create profiles table
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

-- Create events table
create table public.events (
  id          uuid default gen_random_uuid() primary key,
  name        text not null,
  description text,
  date        date not null,
  is_active   boolean default true,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz default now()
);

-- Create attendance table
create table public.attendance (
  id         uuid default gen_random_uuid() primary key,
  event_id   uuid references public.events(id) on delete cascade not null,
  student_id uuid references public.profiles(id) on delete cascade not null,
  marked_at  timestamptz default now(),
  status     text default 'pending', -- 'pending' | 'confirmed'
  unique(event_id, student_id)
);

-- Trigger: auto-create profile on signup
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

-- Row Level Security (RLS) Configuration

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.attendance enable row level security;

-- profiles table policies
create policy "Authenticated read profiles" on public.profiles
  for select
  to authenticated
  using (true);

create policy "Self update" on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Self insert" on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

-- events table policies
create policy "Public read" on public.events
  for select
  using (true);

create policy "Admin write" on public.events
  for all
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- attendance table policies
create policy "Student mark" on public.attendance
  for insert
  to authenticated
  with check (auth.uid() = student_id AND (status IS NULL OR status = 'pending'));

create policy "Self read attendance" on public.attendance
  for select
  to authenticated
  using (auth.uid() = student_id);

create policy "Admin read all attendance" on public.attendance
  for select
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "Admin update status" on public.attendance
  for update
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- Table Grants (Required for Supabase projects created after April 2026 to expose tables to the Data API)
grant select, insert, update on table public.profiles to authenticated;
grant select on table public.profiles to anon;

grant select, insert, update, delete on table public.events to authenticated;
grant select on table public.events to anon;

grant select, insert, update, delete on table public.attendance to authenticated;
grant select on table public.attendance to anon;

