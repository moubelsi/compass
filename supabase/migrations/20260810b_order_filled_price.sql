-- Fix: automation_orders only recorded the signal's indicative price, never
-- the broker's actual fill price. Harmless for paper (they're always equal
-- by construction) but wrong for live — a market order fills at whatever
-- the market is doing, not at the price TradingView happened to report.
-- Discovered via a real OKX demo fill (BTC ~64.3k) landing as the signal's
-- placeholder price (60k) in the published trade's P&L.
-- Run once in the Supabase dashboard SQL editor.

alter table public.automation_orders
  add column if not exists filled_price numeric;
