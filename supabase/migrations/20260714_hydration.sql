-- Daily hydration tracking (dashboard widget + journal day summary).
-- Run once in the Supabase dashboard SQL editor.

create table if not exists public.hydration_days (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  day        date not null,
  ml         integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

alter table public.hydration_days enable row level security;

create policy "select own hydration" on public.hydration_days
  for select using (auth.uid() = user_id);
create policy "insert own hydration" on public.hydration_days
  for insert with check (auth.uid() = user_id);
create policy "update own hydration" on public.hydration_days
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own hydration" on public.hydration_days
  for delete using (auth.uid() = user_id);
