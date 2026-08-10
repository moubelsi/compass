/**
 * Execution-adapter contract — the "last mile" of the pipeline (design doc §8).
 * Paper and live share every step up to this point; only the adapter differs.
 * Deliberately separate from lib/brokers/ (BrokerProvider), which only
 * *imports* historical trades — this interface *places* orders.
 */

export type ExecutionAdapterId = 'paper' | 'ctrader' | 'okx'

export interface OrderRequest {
  symbol: string
  side: 'long' | 'short'
  qty: number
  price: number
  sl: number | null
  tp: number | null
}

export interface CloseRequest {
  symbol: string
  qty: number
  price: number
  /** The opening order's broker result — real adapters read broker-specific
   * context from it (e.g. cTrader's positionId). Paper ignores it. */
  openOrder: { brokerOrderId: string | null; brokerResponse: unknown }
}

export interface OrderResult {
  status: 'filled' | 'rejected' | 'error'
  brokerOrderId: string | null
  brokerResponse: unknown
  filledPrice: number | null
  executionLatencyMs: number
}

export interface ExecutionAdapter {
  id: ExecutionAdapterId
  placeOrder(req: OrderRequest): Promise<OrderResult>
  closePosition(req: CloseRequest): Promise<OrderResult>
}
