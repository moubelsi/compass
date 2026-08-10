-- Automation & Strategy Engine — core schema (Milestone 1: paper-trading pipeline).
-- Run once in the Supabase dashboard SQL editor.
--
-- Every table is user_id-scoped directly (not nested via joins) so RLS policies
-- stay simple, matching broker_connections / hydration_days. The public webhook
-- ingest route (no logged-in user) writes automation_webhook_events /
-- automation_risk_evaluations / automation_orders via the service-role key, after
-- its own token+secret check — so those three tables intentionally get a
-- "select own" policy only, no insert/update/delete policy for the authed user.

-- ── automation_strategies ────────────────────────────────────────────────────
create table if not exists public.automation_strategies (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  archived_at timestamptz
);

alter table public.automation_strategies enable row level security;
create policy "select own strategies" on public.automation_strategies for select using (auth.uid() = user_id);
create policy "insert own strategies" on public.automation_strategies for insert with check (auth.uid() = user_id);
create policy "update own strategies" on public.automation_strategies for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own strategies" on public.automation_strategies for delete using (auth.uid() = user_id);

-- ── automation_strategy_versions ─────────────────────────────────────────────
-- Immutable once status != 'draft' — enforced client-side (the settings form
-- disables its fields) rather than in SQL, matching how the design doc frames
-- versioning: it's a data-hygiene convention, not a security boundary, since
-- every row here already belongs to exactly one user.
create table if not exists public.automation_strategy_versions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  strategy_id        uuid not null references public.automation_strategies (id) on delete cascade,
  version_label      text not null,
  status             text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  mode               text not null default 'off' check (mode in ('off', 'paper', 'live')),
  assets             text[] not null default '{}',
  timeframes         text[] not null default '{}',
  risk_per_trade_pct numeric,
  max_trades_per_day integer,
  max_drawdown_pct   numeric,
  parameters         jsonb not null default '{}'::jsonb,
  filters            jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  activated_at       timestamptz,
  deactivated_at     timestamptz
);

alter table public.automation_strategy_versions enable row level security;
create policy "select own strategy versions" on public.automation_strategy_versions for select using (auth.uid() = user_id);
create policy "insert own strategy versions" on public.automation_strategy_versions for insert with check (auth.uid() = user_id);
create policy "update own strategy versions" on public.automation_strategy_versions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own strategy versions" on public.automation_strategy_versions for delete using (auth.uid() = user_id);

create index if not exists automation_strategy_versions_strategy_idx on public.automation_strategy_versions (strategy_id);

-- ── automation_webhooks ──────────────────────────────────────────────────────
-- Auth model is deliberately NOT HMAC-over-the-body: TradingView alerts can't
-- run code or set custom headers, they can only embed static/placeholder text
-- in the alert JSON. So the real defenses are (1) a long unguessable url_token
-- unique per version, plus (2) a shared webhook_secret the user embeds as a
-- literal string in the alert body (compared with a constant-time check) —
-- the same idea the tradingview-bot prototype used, now unique per version
-- and rotatable instead of one global .env secret.
create table if not exists public.automation_webhooks (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  strategy_version_id uuid not null unique references public.automation_strategy_versions (id) on delete cascade,
  url_token           text not null unique,
  webhook_secret      text not null,
  is_active           boolean not null default true,
  last_received_at    timestamptz,
  created_at          timestamptz not null default now()
);

alter table public.automation_webhooks enable row level security;
create policy "select own webhooks" on public.automation_webhooks for select using (auth.uid() = user_id);
create policy "insert own webhooks" on public.automation_webhooks for insert with check (auth.uid() = user_id);
create policy "update own webhooks" on public.automation_webhooks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own webhooks" on public.automation_webhooks for delete using (auth.uid() = user_id);

-- ── automation_webhook_events (= generalized Signal) ─────────────────────────
create table if not exists public.automation_webhook_events (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  webhook_id       uuid not null references public.automation_webhooks (id) on delete cascade,
  received_at      timestamptz not null default now(),
  raw_payload      jsonb not null,
  secret_valid     boolean not null,
  idempotency_key  text not null,
  parsed_signal    jsonb,
  status           text not null default 'received' check (status in ('received', 'validated', 'rejected', 'queued', 'processed', 'error')),
  rejection_reason text,
  unique (webhook_id, idempotency_key)
);

alter table public.automation_webhook_events enable row level security;
create policy "select own webhook events" on public.automation_webhook_events for select using (auth.uid() = user_id);

create index if not exists automation_webhook_events_webhook_idx on public.automation_webhook_events (webhook_id, received_at desc);

-- ── automation_risk_evaluations ──────────────────────────────────────────────
create table if not exists public.automation_risk_evaluations (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  webhook_event_id     uuid not null references public.automation_webhook_events (id) on delete cascade,
  passed               boolean not null,
  checks               jsonb not null default '{}'::jsonb,
  computed_qty         numeric,
  computed_risk_amount numeric,
  created_at           timestamptz not null default now()
);

alter table public.automation_risk_evaluations enable row level security;
create policy "select own risk evaluations" on public.automation_risk_evaluations for select using (auth.uid() = user_id);

-- ── automation_orders ─────────────────────────────────────────────────────────
-- side='long'/'short' opens a paper position; side='close' closes one via
-- closes_order_id. A Trade (with entry+exit) is only published to `trades`
-- once a close order resolves an open one — see lib/automation/pipeline.ts.
create table if not exists public.automation_orders (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  strategy_version_id  uuid not null references public.automation_strategy_versions (id) on delete cascade,
  webhook_event_id     uuid references public.automation_webhook_events (id) on delete set null,
  closes_order_id      uuid references public.automation_orders (id) on delete set null,
  mode                 text not null check (mode in ('paper', 'live')),
  symbol               text not null,
  side                 text not null check (side in ('long', 'short', 'close')),
  order_type           text not null default 'market',
  requested_price      numeric,
  requested_qty        numeric,
  sl                   numeric,
  tp                   numeric,
  status               text not null default 'pending' check (status in ('pending', 'submitted', 'filled', 'partially_filled', 'cancelled', 'rejected', 'error')),
  broker_order_id      text,
  broker_response      jsonb,
  execution_latency_ms integer,
  created_at           timestamptz not null default now()
);

alter table public.automation_orders enable row level security;
create policy "select own orders" on public.automation_orders for select using (auth.uid() = user_id);

create index if not exists automation_orders_version_idx on public.automation_orders (strategy_version_id, created_at desc);
-- Fast "find the open position for this version+symbol" lookup (close-signal matching).
create index if not exists automation_orders_open_position_idx on public.automation_orders (strategy_version_id, symbol) where side in ('long', 'short') and status = 'filled';

-- ── trades: additive automation columns ──────────────────────────────────────
alter table public.trades
  add column if not exists automation_strategy_version_id uuid references public.automation_strategy_versions (id) on delete set null,
  add column if not exists automation_order_id             uuid references public.automation_orders (id) on delete set null,
  add column if not exists source                          text not null default 'manual' check (source in ('manual', 'tradingview', 'automatic')),
  add column if not exists mode                             text check (mode in ('paper', 'live', 'backtest'));
