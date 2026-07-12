import type { BrokerAccount, BrokerProvider, ImportBatch, ImportStats, NormalizedTrade } from '../types'
import { fetchAssets, fetchHistoryPositions } from './client'

/**
 * MEXC futures. Auth is an API key + secret (read-only is enough); closed
 * positions come from the contract history endpoint with realized PnL, so
 * no leg-pairing is needed. PnL is in the settlement currency (USDT).
 */

const PAGE_SIZE = 100
const MAX_PAGES = 200

function isClosed(p: Record<string, any>): boolean {
  return Number(p.state) === 3 && Number(p.closeVol ?? 0) > 0
}

function toTrade(p: Record<string, any>): NormalizedTrade {
  const openTime  = Number(p.createTime)
  const closeTime = Number(p.updateTime ?? p.createTime)
  const realised  = Number(p.realised ?? 0)
  const holdFee   = Number(p.holdFee ?? 0)
  const profitRatio = p.profitRatio != null ? Number(p.profitRatio) : null

  return {
    symbol: String(p.symbol ?? '').replace(/_/g, ''),
    direction: Number(p.positionType) === 2 ? 'SHORT' : 'LONG',
    entry_price: Number(p.openAvgPrice ?? 0),
    exit_price: Number(p.closeAvgPrice ?? 0),
    pnl: Number(realised.toFixed(2)),
    // profitRatio is return on margin — the closest futures equivalent
    return_pct: profitRatio != null ? Number((profitRatio * 100).toFixed(2)) : null,
    rr: null,
    trade_date: new Date(closeTime).toISOString().slice(0, 10),
    broker: 'mexc',
    broker_trade_id: String(p.positionId),
    broker_metadata: {
      volume: Number(p.closeVol ?? 0),
      gross_pnl: Number(realised.toFixed(2)),
      commission: 0,
      swap: Number(holdFee.toFixed(4)), // funding fees
      open_time: new Date(openTime).toISOString(),
      close_time: new Date(closeTime).toISOString(),
      duration_ms: closeTime - openTime,
      entry_source: 'deals',
    },
    raw_import_data: p,
  }
}

async function verifyCredentials(apiKey: string, apiSecret: string): Promise<BrokerAccount> {
  const assets = await fetchAssets(apiKey, apiSecret)
  const usdt = assets.find(a => String(a.currency).toUpperCase() === 'USDT')
  return {
    id: 'futures',
    brokerName: 'MEXC',
    accountNumber: 'Futures',
    isLive: true,
    currency: 'USDT',
    balance: Number(usdt?.equity ?? usdt?.availableBalance ?? 0),
  }
}

async function importTrades(args: {
  accessToken: string
  secret?: string
  accountId: string
  isLive: boolean
  sinceMs: number
  deadlineMs: number
}): Promise<ImportBatch> {
  const { accessToken: apiKey, secret, sinceMs, deadlineMs } = args
  if (!secret) throw new Error('MEXC connection is missing its API secret. Reconnect the broker.')

  const stats: ImportStats = {
    windows_scanned: 0, deals_seen: 0, positions_seen: 0,
    skipped_still_open: 0, skipped_no_close_legs: 0, skipped_incomplete_chain: 0,
    chain_fetch_failures: 0, trades_built: 0, incomplete_position_ids: [],
  }

  const trades: NormalizedTrade[] = []
  let cursor = sinceMs
  let done = true

  // Newest-first pages; stop once a whole page is older than the cursor
  for (let page = 1; page <= MAX_PAGES; page++) {
    if (Date.now() > deadlineMs) { done = false; break }
    const positions = await fetchHistoryPositions(apiKey, secret, page, PAGE_SIZE)
    if (positions.length === 0) break
    stats.windows_scanned++
    stats.deals_seen += positions.length

    let pageHasNew = false
    for (const p of positions) {
      stats.positions_seen++
      const closedAt = Number(p.updateTime ?? p.createTime ?? 0)
      if (closedAt <= sinceMs) continue
      pageHasNew = true
      if (!isClosed(p)) { stats.skipped_still_open++; continue }
      trades.push(toTrade(p))
      stats.trades_built++
      if (closedAt > cursor) cursor = closedAt
    }

    if (!pageHasNew || positions.length < PAGE_SIZE) break
  }

  return { trades, cursor, done, stats }
}

export const mexcProvider: BrokerProvider = {
  id: 'mexc',
  authType: 'apikey',
  verifyCredentials,
  importTrades,
}
