/**
 * Generic broker-integration contracts. Every broker (cTrader today; MT5,
 * DXtrade, TradeLocker, Tradovate, IBKR later) implements BrokerProvider —
 * routes and UI only ever talk to this interface.
 */

export type BrokerId = 'ctrader'

export interface BrokerTokens {
  accessToken: string
  refreshToken: string
  /** ISO timestamp at which the access token must be refreshed */
  expiresAt: string
}

export interface BrokerAccount {
  /** Stable id used as broker_account_id */
  id: string
  /** Broker/intermediary name shown to the user (e.g. "IC Markets") */
  brokerName: string
  accountNumber: string
  isLive: boolean
  currency: string
  balance: number
}

/** Matches Compass's trades insert shape — dashboard/analytics need no changes */
export interface NormalizedTrade {
  symbol: string
  direction: 'LONG' | 'SHORT'
  entry_price: number
  exit_price: number
  pnl: number
  return_pct: number | null
  rr: number | null
  trade_date: string // YYYY-MM-DD (close date, local)
  broker: BrokerId
  broker_trade_id: string
  broker_metadata: {
    volume: number
    gross_pnl: number
    commission: number
    swap: number
    open_time: string  // ISO
    close_time: string // ISO
    duration_ms: number
  }
  raw_import_data: unknown
}

export interface ImportBatch {
  trades: NormalizedTrade[]
  /** New high-water mark (ms since epoch) to persist as last_deal_timestamp */
  cursor: number
  /** False when the time budget ran out and the caller should invoke again */
  done: boolean
}

export interface BrokerProvider {
  id: BrokerId
  /** URL of the broker's OAuth consent screen */
  getAuthUrl(redirectUri: string, state: string): string
  /** Exchange an authorization code for tokens */
  exchangeCode(code: string, redirectUri: string): Promise<BrokerTokens>
  /** Refresh an expired access token */
  refreshToken(refreshToken: string): Promise<BrokerTokens>
  /** All trading accounts the user granted access to */
  listAccounts(accessToken: string): Promise<BrokerAccount[]>
  /**
   * Import closed trades newer than sinceMs, stopping near deadlineMs
   * (epoch ms) so serverless invocations can resume via the cursor.
   */
  importTrades(args: {
    accessToken: string
    accountId: string
    isLive: boolean
    sinceMs: number
    deadlineMs: number
  }): Promise<ImportBatch>
}
