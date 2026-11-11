-- Study Pulse: AI study assistant tables (run once in Supabase > SQL Editor)
-- Also included in schema.sql for new installs.

create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 4000),
  reviewer_id uuid references public.reviewers (id) on delete set null,
  -- 1 = helpful, -1 = not helpful, null = no feedback yet. Used to find answers that need work.
  feedback smallint check (feedback in (-1, 1)),
  created_at timestamptz not null default now()
);

create index if not exists assistant_messages_user_created_idx
  on public.assistant_messages (user_id, created_at desc);

alter table public.assistant_messages enable row level security;

drop policy if exists "assistant_select_own" on public.assistant_messages;
drop policy if exists "assistant_insert_own" on public.assistant_messages;
drop policy if exists "assistant_update_own" on public.assistant_messages;
drop policy if exists "assistant_delete_own" on public.assistant_messages;
create policy "assistant_select_own" on public.assistant_messages for select using (auth.uid() = user_id);
create policy "assistant_insert_own" on public.assistant_messages for insert with check (auth.uid() = user_id);
create policy "assistant_update_own" on public.assistant_messages for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "assistant_delete_own" on public.assistant_messages for delete using (auth.uid() = user_id);
