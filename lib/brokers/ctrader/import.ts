import { CTraderSession } from './client'
import type { ImportBatch, ImportStats, NormalizedTrade } from '../types'

/**
 * Reconstructs closed trades from cTrader deals.
 *
 * A cTrader position is a chain of deals sharing a positionId: opening legs
 * (scale-ins) have no closePositionDetail, closing legs (scale-outs) do.
 * Compass logs ONE trade per fully closed position:
 *   entry  = volume-weighted average of the opening legs
 *   exit   = volume-weighted average of the closing legs
 *   pnl    = sum(grossProfit) + sum(swap) + sum(all commissions)   [net]
 *
 * Deal history is scanned in 1-week windows (API maximum). When a window
 * contains closing legs of a position whose opening legs fall before the
 * window (scale-in across the sync cursor), the position's complete deal
 * chain is fetched separately so entries are never approximated.
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const MAX_ROWS = 500
/** Historical requests are throttled by the API — keep a polite spacing. */
const REQUEST_SPACING_MS = 130

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function isExecuted(deal: Record<string, any>): boolean {
  const status = String(deal.dealStatus ?? 'FILLED').toUpperCase()
  return status === 'FILLED' || status === 'PARTIALLY_FILLED' || status === '2' || status === '3'
}

function isSell(deal: Record<string, any>): boolean {
  return String(deal.tradeSide).toUpperCase() === 'SELL' || Number(deal.tradeSide) === 2
}

function executedVolume(deal: Record<string, any>): number {
  return Number(deal.filledVolume ?? deal.volume ?? 0)
}

function weightedAvg(pairs: Array<{ price: number; weight: number }>): number {
  const totalW = pairs.reduce((s, p) => s + p.weight, 0)
  if (totalW <= 0) return 0
  return pairs.reduce((s, p) => s + p.price * p.weight, 0) / totalW
}

/** Builds one NormalizedTrade from a position's complete deal chain, or null if not fully closed. */
export function buildTradeFromDeals(
  positionId: number,
  deals: Array<Record<string, any>>,
  symbolName: (id: number) => string,
): NormalizedTrade | null {
  const executed = deals.filter(isExecuted)
  const opens  = executed.filter(d => !d.closePositionDetail)
  const closes = executed.filter(d => d.closePositionDetail)
  if (closes.length === 0) return null

  const openedVolume = opens.reduce((s, d) => s + executedVolume(d), 0)
  const closedVolume = closes.reduce((s, d) => s + Number(d.closePositionDetail.closedVolume ?? executedVolume(d)), 0)
  // Not fully closed (or chain incomplete) — skip; it will import once fully closed
  if (openedVolume === 0 || openedVolume !== closedVolume) return null

  const moneyDigits = Number(closes[0].closePositionDetail.moneyDigits ?? closes[0].moneyDigits ?? 2)
  const scale = 10 ** moneyDigits

  const direction: 'LONG' | 'SHORT' = isSell(opens[0]) ? 'SHORT' : 'LONG'
  const entryPrice = weightedAvg(opens.map(d => ({ price: Number(d.executionPrice ?? 0), weight: executedVolume(d) })))
  const exitPrice  = weightedAvg(closes.map(d => ({
    price: Number(d.executionPrice ?? 0),
    weight: Number(d.closePositionDetail.closedVolume ?? executedVolume(d)),
  })))

  const gross = closes.reduce((s, d) => s + Number(d.closePositionDetail.grossProfit ?? 0), 0) / scale
  const swap  = closes.reduce((s, d) => s + Number(d.closePositionDetail.swap ?? 0), 0) / scale
  const commission = executed.reduce((s, d) => s + Number(d.commission ?? 0), 0) / scale
  // cTrader reports commission as a negative amount; adding yields net PnL
  const net = gross + swap + commission

  const sortedCloses = [...closes].sort((a, b) => Number(a.executionTimestamp) - Number(b.executionTimestamp))
  const lastClose = sortedCloses[sortedCloses.length - 1]
  const balanceAfter = Number(lastClose.closePositionDetail.balance ?? 0) / scale
  const balanceBefore = balanceAfter - net
  const returnPct = balanceBefore > 0 ? (net / balanceBefore) * 100 : null

  const openTime  = Math.min(...opens.map(d => Number(d.executionTimestamp)))
  const closeTime = Math.max(...closes.map(d => Number(d.executionTimestamp)))
  const symbolId = Number(executed[0].symbolId)

  return {
    symbol: symbolName(symbolId),
    direction,
    entry_price: entryPrice,
    exit_price: exitPrice,
    pnl: Number(net.toFixed(2)),
    return_pct: returnPct !== null ? Number(returnPct.toFixed(2)) : null,
    rr: null,
    trade_date: new Date(closeTime).toISOString().slice(0, 10),
    broker: 'ctrader',
    broker_trade_id: String(positionId),
    broker_metadata: {
      volume: closedVolume / 100, // cTrader volumes are in cents of units
      gross_pnl: Number(gross.toFixed(2)),
      commission: Number(commission.toFixed(2)),
      swap: Number(swap.toFixed(2)),
      open_time: new Date(openTime).toISOString(),
      close_time: new Date(closeTime).toISOString(),
      duration_ms: closeTime - openTime,
    },
    raw_import_data: deals,
  }
}

export async function importClosedTrades(args: {
  accessToken: string
  accountId: string
  isLive: boolean
  sinceMs: number
  deadlineMs: number
}): Promise<ImportBatch> {
  const { accessToken, accountId, isLive, sinceMs, deadlineMs } = args
  const ctid = Number(accountId)
  const session = await CTraderSession.connect(isLive ? 'live' : 'demo')

  try {
    await session.authAccount(ctid, accessToken)

    const symbols = await session.getSymbols(ctid)
    const names = new Map<number, string>(symbols.map(s => [Number(s.symbolId), String(s.symbolName ?? s.symbolId)]))
    const symbolName = (id: number) => names.get(id) ?? `#${id}`

    let openPositionIds = new Set<number>()
    try {
      openPositionIds = await session.getOpenPositionIds(ctid)
    } catch { /* best effort — the fully-closed volume check below still protects us */ }

    // First sync starts at account registration; later syncs at the stored cursor
    let from = sinceMs
    if (from <= 0) {
      const trader = await session.getTrader(ctid)
      from = Number(trader.registrationTimestamp ?? 0) || Date.now() - 5 * 365 * 24 * 60 * 60 * 1000
    }

    const now = Date.now()
    const byPosition = new Map<number, Array<Record<string, any>>>()
    let cursor = from
    let done = true
    const stats: ImportStats = {
      windows_scanned: 0, deals_seen: 0, positions_seen: 0,
      skipped_still_open: 0, skipped_no_close_legs: 0, skipped_incomplete_chain: 0,
      trades_built: 0, incomplete_position_ids: [],
    }

    while (from < now) {
      if (Date.now() > deadlineMs) { done = false; break }
      const to = Math.min(from + WEEK_MS, now)

      // A window can hold more deals than one response returns — page inside it
      let pageFrom = from
      const seen = new Set<string>()
      for (;;) {
        await sleep(REQUEST_SPACING_MS)
        const deals = await session.getDeals(ctid, pageFrom, to, MAX_ROWS)
        for (const d of deals) {
          const key = String(d.dealId)
          if (seen.has(key)) continue
          seen.add(key)
          const pos = Number(d.positionId)
          if (!byPosition.has(pos)) byPosition.set(pos, [])
          byPosition.get(pos)!.push(d)
        }
        if (deals.length < MAX_ROWS) break
        pageFrom = Math.max(...deals.map(d => Number(d.executionTimestamp)))
      }

      stats.windows_scanned++
      stats.deals_seen += seen.size
      cursor = to
      from = to
    }

    const trades: NormalizedTrade[] = []
    for (const [positionId, deals] of byPosition) {
      stats.positions_seen++
      if (openPositionIds.has(positionId)) { stats.skipped_still_open++; continue }
      const closes = deals.filter(d => d.closePositionDetail && isExecuted(d))
      if (closes.length === 0) { stats.skipped_no_close_legs++; continue }

      let chain = deals
      const openedVolume = deals.filter(d => !d.closePositionDetail && isExecuted(d)).reduce((s, d) => s + executedVolume(d), 0)
      const closedVolume = closes.reduce((s, d) => s + Number(d.closePositionDetail.closedVolume ?? executedVolume(d)), 0)
      if (openedVolume < closedVolume) {
        // Opening legs precede the scan window — fetch the position's full chain
        await sleep(REQUEST_SPACING_MS)
        try { chain = await session.getDealsByPosition(ctid, positionId) } catch { /* keep partial chain; volume check will skip it */ }
      }

      const trade = buildTradeFromDeals(positionId, chain, symbolName)
      if (trade) {
        trades.push(trade)
        stats.trades_built++
      } else {
        stats.skipped_incomplete_chain++
        if (stats.incomplete_position_ids.length < 20) stats.incomplete_position_ids.push(positionId)
      }
    }

    return { trades, cursor, done, stats }
  } finally {
    session.close()
  }
}
