import { hasContent } from './utils'

export interface DisciplineTrade {
  trade_type?: string | null
  followed_plan?: boolean | null
  confidence?: number | string | null
  notes?: string | null
  screenshot_url?: string | null
}

/**
 * Discipline score (0–100), weighted: planned trades 40 · followed plan 30 · avg confidence 20 · journaled 10.
 * Single source of truth — used by analytics; the AI coach should reuse this rather than re-derive it.
 */
export function computeDiscipline(trades: DisciplineTrade[]) {
  const total         = trades.length
  const typedCount    = trades.filter(t => t.trade_type != null).length
  const plannedCount  = trades.filter(t => t.trade_type === 'planned').length
  const followedCount = trades.filter(t => t.followed_plan).length
  const confTrades    = trades.filter(t => t.confidence != null)
  const journalCount  = trades.filter(t => hasContent(t.notes) || hasContent(t.screenshot_url)).length

  const plannedPct  = typedCount > 0 ? plannedCount / typedCount : 0
  const followedPct = total > 0 ? followedCount / total : 0
  const avgConf     = confTrades.length > 0 ? confTrades.reduce((s, t) => s + Number(t.confidence), 0) / confTrades.length : 0
  const journalPct  = total > 0 ? journalCount / total : 0
  const score       = total > 0 ? Math.round(plannedPct * 40 + followedPct * 30 + (avgConf / 10) * 20 + journalPct * 10) : null

  return { score, plannedPct, followedPct, journalPct, avgConf, typedCount, plannedCount, followedCount }
}
