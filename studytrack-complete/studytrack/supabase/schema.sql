-- StudyTrack database schema
-- Run this whole file once in Supabase: SQL Editor > New query > paste > Run.

create extension if not exists "pgcrypto";

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  school text,
  year_level text,
  avatar_url text,
  reminder_settings jsonb not null default
    '{"three_days": true, "one_day": true, "due_day": true, "email": false}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------- subjects ----------
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  teacher text,
  color text not null default '#4f46e5',
  created_at timestamptz not null default now()
);

-- ---------- tasks ----------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  title text not null,
  notes text,
  due_at timestamptz not null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- classes (weekly timetable) ----------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7), -- 1 = Monday ... 7 = Sunday
  start_time time not null,
  end_time time not null,
  room text,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

-- ---------- exams ----------
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  exam_date date not null,
  title text,
  created_at timestamptz not null default now()
);

-- ---------- review sessions ----------
create table if not exists public.review_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  exam_id uuid not null references public.exams (id) on delete cascade,
  session_date date not null,
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists tasks_user_due_idx on public.tasks (user_id, due_at);
create index if not exists classes_user_day_idx on public.classes (user_id, day_of_week);
create index if not exists exams_user_date_idx on public.exams (user_id, exam_date);
create index if not exists review_user_date_idx on public.review_sessions (user_id, session_date);

-- ---------- Row Level Security: every user only sees their own rows ----------
alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.tasks enable row level security;
alter table public.classes enable row level security;
alter table public.exams enable row level security;
alter table public.review_sessions enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

do $$
declare t text;
begin
  foreach t in array array['subjects', 'tasks', 'classes', 'exams', 'review_sessions']
  loop
    execute format('drop policy if exists "%1$s_select_own" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_insert_own" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_update_own" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_delete_own" on public.%1$s', t);
    execute format('create policy "%1$s_select_own" on public.%1$s for select using (auth.uid() = user_id)', t);
    execute format('create policy "%1$s_insert_own" on public.%1$s for insert with check (auth.uid() = user_id)', t);
    execute format('create policy "%1$s_update_own" on public.%1$s for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy "%1$s_delete_own" on public.%1$s for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ---------- Auto-create a profile when someone signs up ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for anyone who signed up before this script was run
insert into public.profiles (id, full_name)
select u.id, coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name')
from auth.users u
on conflict (id) do nothing;

-- ---------- AI reviewers (generated from uploaded files) ----------

create table if not exists public.reviewers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  title text not null,
  source_name text,
  content jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists reviewers_user_created_idx on public.reviewers (user_id, created_at desc);

alter table public.reviewers enable row level security;

drop policy if exists "reviewers_select_own" on public.reviewers;
drop policy if exists "reviewers_insert_own" on public.reviewers;
drop policy if exists "reviewers_update_own" on public.reviewers;
drop policy if exists "reviewers_delete_own" on public.reviewers;
create policy "reviewers_select_own" on public.reviewers for select using (auth.uid() = user_id);
create policy "reviewers_insert_own" on public.reviewers for insert with check (auth.uid() = user_id);
create policy "reviewers_update_own" on public.reviewers for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "reviewers_delete_own" on public.reviewers for delete using (auth.uid() = user_id);
