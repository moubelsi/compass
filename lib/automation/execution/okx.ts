import type { ExecutionAdapter, OrderResult } from './types'
import { placeMarketOrder, type OkxCredentials } from '@/lib/brokers/okx/client'

function rejected(startedAt: number, message: string): OrderResult {
  return { status: 'rejected', brokerOrderId: null, brokerResponse: { error: message }, filledPrice: null, executionLatencyMs: Date.now() - startedAt }
}

/**
 * Spot-only for now — OKX spot has no short-selling without margin, which
 * is a bigger, separate feature (borrowing, liquidation risk) than "place a
 * BTC order". `long` = buy, closing a long = sell. `short` is rejected with
 * a clear reason rather than silently doing the wrong thing.
 */
export function createOkxAdapter(creds: OkxCredentials, isLive: boolean): ExecutionAdapter {
  const isDemo = !isLive

  return {
    id: 'okx',

    async placeOrder(req) {
      const start = Date.now()
      if (req.side === 'short') {
        return rejected(start, 'OKX spot trading does not support short entries yet (no margin/derivatives support).')
      }
      const result = await placeMarketOrder(creds, isDemo, { instId: req.symbol, side: 'buy', sz: String(req.qty) })
      if (!result.ok) {
        return { status: 'rejected', brokerOrderId: result.ordId, brokerResponse: result.raw, filledPrice: null, executionLatencyMs: Date.now() - start }
      }
      return {
        status: 'filled',
        brokerOrderId: result.ordId,
        brokerResponse: result.raw,
        filledPrice: result.avgPx ?? req.price,
        executionLatencyMs: Date.now() - start,
      }
    },

    async closePosition(req) {
      const start = Date.now()
      const result = await placeMarketOrder(creds, isDemo, { instId: req.symbol, side: 'sell', sz: String(req.qty) })
      if (!result.ok) {
        return { status: 'rejected', brokerOrderId: result.ordId, brokerResponse: result.raw, filledPrice: null, executionLatencyMs: Date.now() - start }
      }
      return {
        status: 'filled',
        brokerOrderId: result.ordId,
        brokerResponse: result.raw,
        filledPrice: result.avgPx ?? req.price,
        executionLatencyMs: Date.now() - start,
      }
    },
  }
}
