/**
 * Generic broker-integration contracts. Every broker (cTrader today; MT5,
 * DXtrade, TradeLocker, Tradovate, IBKR later) implements BrokerProvider —
 * routes and UI only ever talk to this interface.
 */

export type BrokerId = 'ctrader' | 'mexc'

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
    /** 'deals' = entry from actual opening legs; 'close_detail' = entry from closePositionDetail */
    entry_source: 'deals' | 'close_detail'
  }
  raw_import_data: unknown
}

/** Diagnostic counters filled during an import pass — used by the dry-run endpoint. */
export interface ImportStats {
  windows_scanned: number
  deals_seen: number
  positions_seen: number
  skipped_still_open: number
  skipped_no_close_legs: number
  skipped_incomplete_chain: number
  chain_fetch_failures: number
  trades_built: number
  incomplete_position_ids: number[]
}

export interface ImportBatch {
  trades: NormalizedTrade[]
  /** New high-water mark (ms since epoch) to persist as last_deal_timestamp */
  cursor: number
  /** False when the time budget ran out and the caller should invoke again */
  done: boolean
  stats: ImportStats
}

export interface BrokerProvider {
  id: BrokerId
  /** 'oauth' brokers redirect to a consent screen; 'apikey' brokers take a key + secret */
  authType: 'oauth' | 'apikey'
  /** URL of the broker's OAuth consent screen (oauth brokers) */
  getAuthUrl?(redirectUri: string, state: string): string
  /** Exchange an authorization code for tokens (oauth brokers) */
  exchangeCode?(code: string, redirectUri: string): Promise<BrokerTokens>
  /** Refresh an expired access token (oauth brokers) */
  refreshToken?(refreshToken: string): Promise<BrokerTokens>
  /** Validate an API key + secret and return basic account info (apikey brokers) */
  verifyCredentials?(apiKey: string, apiSecret: string): Promise<BrokerAccount>
  /** All trading accounts the user granted access to (oauth brokers) */
  listAccounts?(accessToken: string): Promise<BrokerAccount[]>
  /**
   * Import closed trades newer than sinceMs, stopping near deadlineMs
   * (epoch ms) so serverless invocations can resume via the cursor.
   * For apikey brokers `secret` carries the API secret.
   */
  importTrades(args: {
    accessToken: string
    secret?: string
    accountId: string
    isLive: boolean
    sinceMs: number
    deadlineMs: number
  }): Promise<ImportBatch>
}
