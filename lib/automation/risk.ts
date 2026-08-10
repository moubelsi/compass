import type { SupabaseClient } from '@supabase/supabase-js'
import type { Signal } from './signal'
import { findOpenEntryOrder } from './positions'

export interface RiskCheck { ok: boolean; detail: string }
export type RiskChecks = Record<string, RiskCheck>

export interface RiskResult {
  passed: boolean
  checks: RiskChecks
  computedQty: number | null
  computedRiskAmount: number | null
}

export interface SessionWindow {
  name?: string
  /** 0 = Sunday .. 6 = Saturday (UTC, matches Date#getUTCDay) */
  days: number[]
  start_utc: string // "HH:MM"
  end_utc: string // "HH:MM"
}

export interface VersionForRisk {
  id: string
  risk_per_trade_pct: number | null
  max_trades_per_day: number | null
  max_drawdown_pct: number | null
  filters: { sessions?: SessionWindow[] } | null
}

/**
 * Nominal paper-account baseline used only for position-sizing math (there's
 * no real balance to size against yet). Revisit once M2 introduces actual
 * broker accounts with real equity.
 */
const NOMINAL_PAPER_EQUITY = 10_000

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function checkSession(sessions: SessionWindow[] | undefined, now: Date): RiskCheck {
  if (!sessions || sessions.length === 0) return { ok: true, detail: 'no session filter configured' }
  const day = now.getUTCDay()
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes()
  const inAny = sessions.some(s => {
    if (!s.days.includes(day)) return false
    const start = toMinutes(s.start_utc)
    const end = toMinutes(s.end_utc)
    return start <= end ? minutes >= start && minutes <= end : minutes >= start || minutes <= end
  })
  return { ok: inAny, detail: inAny ? 'within a configured session' : 'outside all configured sessions' }
}

/** Entry-signal checks: sizing, session, daily cap, drawdown kill-switch, no stacking. */
export async function evaluateEntryRisk(supabase: SupabaseClient, version: VersionForRisk, signal: Signal): Promise<RiskResult> {
  const checks: RiskChecks = {}

  checks.stop_loss_present = signal.sl != null
    ? { ok: true, detail: `sl=${signal.sl}` }
    : { ok: false, detail: 'signal has no sl — required for position sizing' }

  checks.session = checkSession(version.filters?.sessions, new Date())

  let computedRiskAmount: number | null = null
  let computedQty: number | null = null
  if (signal.sl != null && version.risk_per_trade_pct != null) {
    const stopDistance = Math.abs(signal.price - signal.sl)
    if (stopDistance > 0) {
      computedRiskAmount = NOMINAL_PAPER_EQUITY * (version.risk_per_trade_pct / 100)
      computedQty = computedRiskAmount / stopDistance
    }
  }
  checks.risk_sizing = computedQty != null
    ? { ok: true, detail: `qty=${computedQty.toFixed(4)}, risk=${computedRiskAmount!.toFixed(2)}` }
    : { ok: false, detail: 'risk_per_trade_pct not configured, or sl equals price' }

  if (version.max_trades_per_day != null) {
    const since = new Date()
    since.setUTCHours(0, 0, 0, 0)
    const { count } = await supabase
      .from('automation_orders')
      .select('id', { count: 'exact', head: true })
      .eq('strategy_version_id', version.id)
      .in('side', ['long', 'short'])
      .eq('status', 'filled')
      .gte('created_at', since.toISOString())
    const current = count ?? 0
    checks.max_trades_per_day = { ok: current < version.max_trades_per_day, detail: `${current}/${version.max_trades_per_day} today` }
  }

  if (version.max_drawdown_pct != null) {
    const { data } = await supabase
      .from('trades')
      .select('return_pct, trade_date')
      .eq('automation_strategy_version_id', version.id)
      .order('trade_date', { ascending: true })
    let equity = 0, peak = 0, maxDrawdown = 0
    for (const t of data ?? []) {
      equity += Number(t.return_pct) || 0
      peak = Math.max(peak, equity)
      maxDrawdown = Math.max(maxDrawdown, peak - equity)
    }
    checks.max_drawdown = {
      ok: maxDrawdown < version.max_drawdown_pct,
      detail: `${maxDrawdown.toFixed(2)}%/${version.max_drawdown_pct}% cumulative drawdown`,
    }
  }

  const openOrder = await findOpenEntryOrder(supabase, version.id, signal.symbol)
  checks.no_open_position = openOrder
    ? { ok: false, detail: `position already open on ${signal.symbol} (order ${openOrder.id})` }
    : { ok: true, detail: 'no open position on this symbol' }

  return {
    passed: Object.values(checks).every(c => c.ok),
    checks,
    computedQty,
    computedRiskAmount,
  }
}

/** Close-signal checks: is there actually an open position to close. */
export async function evaluateCloseRisk(supabase: SupabaseClient, version: { id: string }, signal: Signal): Promise<RiskResult> {
  const openOrder = await findOpenEntryOrder(supabase, version.id, signal.symbol)
  const checks: RiskChecks = {
    open_position_exists: openOrder
      ? { ok: true, detail: `order ${openOrder.id}` }
      : { ok: false, detail: 'no open position to close' },
  }
  return {
    passed: !!openOrder,
    checks,
    computedQty: openOrder?.requested_qty ?? null,
    computedRiskAmount: null,
  }
}
