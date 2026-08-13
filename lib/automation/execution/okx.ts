import type { ExecutionAdapter, OrderResult } from './types'
import { placeMarketOrder, placeMarginOrder, type OkxCredentials } from '@/lib/brokers/okx/client'

function rejected(startedAt: number, message: string): OrderResult {
  return { status: 'rejected', brokerOrderId: null, brokerResponse: { error: message }, filledPrice: null, executionLatencyMs: Date.now() - startedAt }
}

function toResult(start: number, result: { ok: boolean; ordId: string | null; avgPx: number | null; raw: unknown }, fallbackPrice: number): OrderResult {
  if (!result.ok) {
    return { status: 'rejected', brokerOrderId: result.ordId, brokerResponse: result.raw, filledPrice: null, executionLatencyMs: Date.now() - start }
  }
  return {
    status: 'filled',
    brokerOrderId: result.ordId,
    brokerResponse: result.raw,
    filledPrice: result.avgPx ?? fallbackPrice,
    executionLatencyMs: Date.now() - start,
  }
}

// BTC-EUR spot-margin spec, confirmed via /api/v5/public/instruments
// (2026-08-12): lotSz 0.00000001, minSz 0.0001 BTC.
const MARGIN_MIN_SZ = 0.0001

function marginQty(qtyBtc: number): string {
  return Math.max(MARGIN_MIN_SZ, qtyBtc).toFixed(8)
}

function isMargin(symbol: string): boolean {
  // BTC-EUR is the one margin-enabled pair on this account — cross only.
  // OKX has no isolated-margin variant for it, and BTC-USDC/BTC-USDT margin
  // are dead ends here too (USDC has no margin pair at all; USDT itself
  // isn't tradeable on this EU-regulated account). Confirmed 2026-08-12.
  return symbol.toUpperCase() === 'BTC-EUR'
}

/**
 * Spot-cash symbols (e.g. BTC-USDC) stay long-only — no margin/derivatives
 * support. `BTC-EUR` routes through the margin path instead, which supports
 * both directions (borrowing to short) with exchange-enforced SL/TP since
 * margin brings liquidation risk that plain spot never had.
 */
export function createOkxAdapter(creds: OkxCredentials, isLive: boolean): ExecutionAdapter {
  const isDemo = !isLive

  return {
    id: 'okx',

    async placeOrder(req) {
      const start = Date.now()

      if (isMargin(req.symbol)) {
        const result = await placeMarginOrder(creds, isDemo, {
          instId: req.symbol,
          side: req.side === 'long' ? 'buy' : 'sell',
          sz: marginQty(req.qty),
          sl: req.sl,
          tp: req.tp,
        })
        return toResult(start, result, req.price)
      }

      if (req.side === 'short') {
        return rejected(start, 'This OKX symbol does not support short entries (spot cash only). Use BTC-EUR for margin shorts.')
      }
      const result = await placeMarketOrder(creds, isDemo, { instId: req.symbol, side: 'buy', sz: String(req.qty) })
      return toResult(start, result, req.price)
    },

    async closePosition(req) {
      const start = Date.now()

      if (isMargin(req.symbol)) {
        const openSide = (req.openOrder.brokerResponse as { openSide?: 'buy' | 'sell' } | null)?.openSide
        const closeSide = openSide === 'sell' ? 'buy' : 'sell'
        const result = await placeMarginOrder(creds, isDemo, {
          instId: req.symbol,
          side: closeSide,
          sz: marginQty(req.qty),
          sl: null,
          tp: null,
        })
        return toResult(start, result, req.price)
      }

      const result = await placeMarketOrder(creds, isDemo, { instId: req.symbol, side: 'sell', sz: String(req.qty) })
      return toResult(start, result, req.price)
    },
  }
}
