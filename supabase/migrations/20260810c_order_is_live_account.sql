-- Fix: a "live" mode order/trade only ever recorded mode='live', never
-- whether the connected broker account was itself demo or real — so once
-- someone has both a demo and a real live account, everything shows as one
-- undifferentiated "Live" bucket in the Automation UI. Denormalized at
-- execution time (not derived from the version's *current* broker_account_id,
-- which could be reassigned later) so history stays accurate.
-- Run once in the Supabase dashboard SQL editor.

alter table public.automation_orders
  add column if not exists is_live_account boolean;

alter table public.trades
  add column if not exists is_live_account boolean;
