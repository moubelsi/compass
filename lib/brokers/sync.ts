import type { SupabaseClient } from '@supabase/supabase-js'
import { getProvider } from './index'
import type { BrokerConnectionRow } from './ctrader/connection'

/** Leave headroom for the upsert + response inside the 60s function budget. */
const TIME_BUDGET_MS = 40_000
const UPSERT_CHUNK = 200

export interface SyncOutcome {
  imported: number
  done: boolean
}

/**
 * One sync pass: import closed trades from the connection's cursor onward,
 * batch-upsert them (ON CONFLICT DO NOTHING keeps user edits and blocks
 * duplicates) and advance the cursor. Callers repeat while !done.
 */
export async function runSync(supabase: SupabaseClient, userId: string, conn: BrokerConnectionRow): Promise<SyncOutcome> {
  if (!conn.broker_account_id) {
    throw new NoAccountSelectedError()
  }

  const account = conn.account_info?.accounts?.find(a => a.id === conn.broker_account_id)
  const isLive = account ? !!account.isLive : true

  const batch = await getProvider('ctrader').importTrades({
    accessToken: conn.access_token,
    accountId: conn.broker_account_id,
    isLive,
    sinceMs: Number(conn.last_deal_timestamp) || 0,
    deadlineMs: Date.now() + TIME_BUDGET_MS,
  })

  let imported = 0
  for (let i = 0; i < batch.trades.length; i += UPSERT_CHUNK) {
    const rows = batch.trades.slice(i, i + UPSERT_CHUNK).map(t => ({ ...t, user_id: userId }))
    const { data, error } = await supabase
      .from('trades')
      .upsert(rows, { onConflict: 'user_id,broker,broker_trade_id', ignoreDuplicates: true })
      .select('id')
    if (error) throw new Error(`Saving trades failed: ${error.message}`)
    imported += data?.length ?? 0
  }

  const { error: cursorError } = await supabase
    .from('broker_connections')
    .update({
      last_deal_timestamp: batch.cursor,
      ...(batch.done ? { last_synced_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', conn.id)
  if (cursorError) throw new Error(cursorError.message)

  return { imported, done: batch.done }
}

export class NoAccountSelectedError extends Error {
  constructor() {
    super('Select a trading account first.')
    this.name = 'NoAccountSelectedError'
  }
}
