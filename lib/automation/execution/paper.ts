import { randomUUID } from 'crypto'
import type { ExecutionAdapter, OrderResult } from './types'

/**
 * Simulates fills at the signal's own reported price — no live price feed
 * lookup yet. That's an honest simplification for M1 (proving the pipeline
 * safely, no real money at risk), not a claim of realistic slippage/spread
 * modelling. A future improvement could fetch a live quote via the existing
 * cTrader session for a more realistic paper fill.
 */
function fill(price: number): OrderResult {
  return {
    status: 'filled',
    brokerOrderId: `paper-${randomUUID()}`,
    brokerResponse: { simulated: true },
    filledPrice: price,
    executionLatencyMs: 0,
  }
}

export const paperExecutionAdapter: ExecutionAdapter = {
  id: 'paper',
  async placeOrder(req) {
    return fill(req.price)
  },
  async closePosition(req) {
    return fill(req.price)
  },
}
