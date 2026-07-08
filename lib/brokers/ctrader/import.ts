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

/**
 * Builds one NormalizedTrade from a position's deal chain, or null if the
 * position is not verifiably closed.
 *
 * Preferred path: complete chain (opening legs present, volumes balance) —
 * entry from the actual opening deals. Fallback path (allowCloseOnly): only
 * closing legs available (chain crosses the scan boundary and the by-position
 * lookup failed) — entry from closePositionDetail.entryPrice, which every
 * closing deal carries; opening-leg commission is then not recoverable.
 */
export function buildTradeFromDeals(
  positionId: number,
  deals: Array<Record<string, any>>,
  symbolName: (id: number) => string,
  allowCloseOnly = false,
): NormalizedTrade | null {
  const executed = deals.filter(isExecuted)
  const opens  = executed.filter(d => !d.closePositionDetail)
  const closes = executed.filter(d => d.closePositionDetail)
  if (closes.length === 0) return null

  const openedVolume = opens.reduce((s, d) => s + executedVolume(d), 0)
  const closedVolume = closes.reduce((s, d) => s + Number(d.closePositionDetail.closedVolume ?? executedVolume(d)), 0)
  if (closedVolume === 0) return null

  const complete = opens.length > 0 && openedVolume === closedVolume
  // Opening legs partially present but unbalanced: either still open or a
  // broken chain — never guess
  if (!complete && opens.length > 0) return null
  // Close-only chains are only trusted when the open-positions check ran
  if (!complete && !allowCloseOnly) return null

  const moneyDigits = Number(closes[0].closePositionDetail.moneyDigits ?? closes[0].moneyDigits ?? 2)
  const scale = 10 ** moneyDigits

  // Closing a LONG is a SELL, so close-only chains invert the close side
  const direction: 'LONG' | 'SHORT' = complete
    ? (isSell(opens[0]) ? 'SHORT' : 'LONG')
    : (isSell(closes[0]) ? 'LONG' : 'SHORT')
  const entryPrice = complete
    ? weightedAvg(opens.map(d => ({ price: Number(d.executionPrice ?? 0), weight: executedVolume(d) })))
    : weightedAvg(closes.map(d => ({
        price: Number(d.closePositionDetail.entryPrice ?? 0),
        weight: Number(d.closePositionDetail.closedVolume ?? executedVolume(d)),
      })))
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

  const closeTime = Math.max(...closes.map(d => Number(d.executionTimestamp)))
  // Close-only chains don't know the true open moment — approximate with the first close
  const openTime = complete
    ? Math.min(...opens.map(d => Number(d.executionTimestamp)))
    : Math.min(...closes.map(d => Number(d.createTimestamp ?? d.executionTimestamp)))
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
      entry_source: complete ? 'deals' : 'close_detail',
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
    let reconcileOk = false
    try {
      openPositionIds = await session.getOpenPositionIds(ctid)
      reconcileOk = true
    } catch { /* best effort — close-only fallback is disabled below when this fails */ }

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
      chain_fetch_failures: 0, trades_built: 0, incomplete_position_ids: [],
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
        try {
          chain = await session.getDealsByPosition(ctid, positionId)
        } catch {
          // Keep the close legs — buildTradeFromDeals falls back to closePositionDetail
          stats.chain_fetch_failures++
        }
      }

      const trade = buildTradeFromDeals(positionId, chain, symbolName, reconcileOk)
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
