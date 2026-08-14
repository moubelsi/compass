import type { SupabaseClient } from '@supabase/supabase-js'
import { getFreshCTraderCredentials } from './broker-accounts'
import { CTraderSession, type CTraderHost } from '@/lib/brokers/ctrader/client'
import { getTickerPrice } from '@/lib/brokers/okx/client'

/**
 * Live price per symbol for one broker account — one cTrader session (or a
 * handful of OKX ticker calls) covers every open position on that account,
 * rather than reconnecting per position. Best-effort: a broker/network
 * hiccup here returns nulls for that account's symbols instead of failing
 * the whole request, since this backs a live-updating UI panel, not a
 * trading decision.
 */
export async function getLivePricesForBrokerAccount(
  supabase: SupabaseClient,
  brokerAccountId: string,
  broker: 'ctrader' | 'okx',
  isLive: boolean,
  symbols: string[],
): Promise<Record<string, number | null>> {
  const prices: Record<string, number | null> = {}
  if (symbols.length === 0) return prices

  try {
    if (broker === 'ctrader') {
      const creds = await getFreshCTraderCredentials(supabase, brokerAccountId)
      if (creds) {
        const host: CTraderHost = isLive ? 'live' : 'demo'
        const session = await CTraderSession.connect(host)
        try {
          await session.authAccount(creds.ctidTraderAccountId, creds.accessToken)
          const allSymbols = await session.getSymbols(creds.ctidTraderAccountId)
          for (const sym of symbols) {
            const match = allSymbols.find(s => String(s.symbolName ?? '').toUpperCase() === sym.toUpperCase())
            prices[sym] = match ? await session.getLatestPrice(creds.ctidTraderAccountId, Number(match.symbolId)) : null
          }
        } finally {
          session.close()
        }
      }
    } else if (broker === 'okx') {
      for (const sym of symbols) {
        prices[sym] = await getTickerPrice(sym)
      }
    }
  } catch {
    // best-effort — see doc comment above
  }

  return prices
}

/** Mirrors publishTrade()'s realized-P&L formula (pipeline.ts) so an
 * unrealized number shown in the UI matches what a "close" signal would
 * actually produce. */
export function computeUnrealizedPnl(side: 'long' | 'short', entry: number, qty: number, currentPrice: number | null) {
  if (currentPrice == null) return { unrealizedPnl: null as number | null, unrealizedReturnPct: null as number | null }
  const sign = side === 'long' ? 1 : -1
  const unrealizedPnl = sign * (currentPrice - entry) * qty
  const unrealizedReturnPct = entry !== 0 ? (unrealizedPnl / (entry * qty)) * 100 : null
  return { unrealizedPnl, unrealizedReturnPct }
}
