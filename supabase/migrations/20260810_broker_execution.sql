-- Broker execution accounts + audit log (Milestone 2: cTrader + OKX demo execution).
-- Run once in the Supabase dashboard SQL editor.
--
-- Credentials use application-level AES-256-GCM (lib/automation/crypto.ts),
-- not Supabase Vault: Vault's decrypted_secrets view isn't reachable through
-- the REST client without an extra manual "expose the vault schema"
-- dashboard step, and this needs to work without that. The line below is
-- harmless if it fails (e.g. not available on this plan) — skip it and run
-- the rest; nothing here depends on it succeeding.
create extension if not exists supabase_vault;

-- ── automation_broker_accounts ───────────────────────────────────────────────
-- Separate from `broker_connections` (the existing read-only cTrader/MEXC
-- import feature) on purpose — a compromised trading credential must never
-- be conflatable with the harmless read-only one, and this table's rows are
-- always is_live-labelled so the UI can never be ambiguous about stakes.
create table if not exists public.automation_broker_accounts (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  broker               text not null check (broker in ('ctrader', 'okx')),
  label                text not null,
  is_live              boolean not null default false,
  -- { method: 'vault', secret_id: uuid } or { method: 'aesgcm', iv: text, ciphertext: text }
  credentials          jsonb not null,
  status               text not null default 'connected' check (status in ('connected', 'disconnected', 'error')),
  last_health_check_at timestamptz,
  created_at           timestamptz not null default now()
);

alter table public.automation_broker_accounts enable row level security;
create policy "select own broker accounts" on public.automation_broker_accounts for select using (auth.uid() = user_id);
create policy "insert own broker accounts" on public.automation_broker_accounts for insert with check (auth.uid() = user_id);
create policy "update own broker accounts" on public.automation_broker_accounts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own broker accounts" on public.automation_broker_accounts for delete using (auth.uid() = user_id);

-- ── automation_audit_log ─────────────────────────────────────────────────────
create table if not exists public.automation_audit_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  action     text not null,
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.automation_audit_log enable row level security;
create policy "select own audit log" on public.automation_audit_log for select using (auth.uid() = user_id);
create policy "insert own audit log" on public.automation_audit_log for insert with check (auth.uid() = user_id);

create index if not exists automation_audit_log_user_idx on public.automation_audit_log (user_id, created_at desc);

-- ── automation_strategy_versions: the broker_account_id deferred from M1 ────
alter table public.automation_strategy_versions
  add column if not exists broker_account_id uuid references public.automation_broker_accounts (id) on delete set null;
