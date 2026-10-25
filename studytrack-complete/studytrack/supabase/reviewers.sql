-- StudyTrack: AI reviewers table (run this once in Supabase > SQL Editor)

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
