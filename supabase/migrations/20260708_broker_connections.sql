-- Broker integrations: connection storage + broker columns on trades.
-- Run once in the Supabase dashboard SQL editor.

-- ── broker_connections ──────────────────────────────────────────────────────
create table if not exists public.broker_connections (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  broker              text not null,
  broker_account_id   text,
  access_token        text not null,
  refresh_token       text not null,
  expires_at          timestamptz not null,
  account_info        jsonb,
  last_synced_at      timestamptz,
  -- High-water mark (ms since epoch) of the newest imported deal; sync resumes from here
  last_deal_timestamp bigint not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, broker)
);

alter table public.broker_connections enable row level security;

create policy "select own broker connections" on public.broker_connections
  for select using (auth.uid() = user_id);
create policy "insert own broker connections" on public.broker_connections
  for insert with check (auth.uid() = user_id);
create policy "update own broker connections" on public.broker_connections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own broker connections" on public.broker_connections
  for delete using (auth.uid() = user_id);

-- ── trades: additive broker columns (existing rows/flows unaffected) ────────
alter table public.trades
  add column if not exists broker          text,
  add column if not exists broker_trade_id text,
  add column if not exists broker_metadata jsonb,
  add column if not exists raw_import_data jsonb;

-- Hard dedupe for imported trades. NULLs are distinct in Postgres, so
-- manually logged trades (broker is null) are never constrained by this.
create unique index if not exists trades_user_broker_trade_uidx
  on public.trades (user_id, broker, broker_trade_id);
