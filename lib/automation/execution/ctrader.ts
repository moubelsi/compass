import { CTraderSession, TRADE_SIDE, type CTraderHost } from '@/lib/brokers/ctrader/client'
import type { ExecutionAdapter, OrderResult } from './types'

export interface CTraderCredentials {
  accessToken: string
  ctidTraderAccountId: number
}

function extractFillPrice(execution: Record<string, unknown> | undefined): number | null {
  // Best-effort across the shapes cTrader's ProtoOAExecutionEvent can take —
  // verify against a real demo-account response the first time this runs
  // and tighten if the actual field differs.
  const deal = execution?.deal as Record<string, unknown> | undefined
  const order = execution?.order as Record<string, unknown> | undefined
  const position = execution?.position as Record<string, unknown> | undefined
  const raw = deal?.executionPrice ?? order?.executionPrice ?? position?.price
  return raw != null ? Number(raw) : null
}

function extractPositionId(brokerResponse: unknown): number | null {
  const r = brokerResponse as Record<string, unknown> | undefined
  const position = r?.position as Record<string, unknown> | undefined
  const id = position?.positionId ?? r?.positionId
  return id != null ? Number(id) : null
}

function errorResult(startedAt: number, err: unknown): OrderResult {
  return {
    status: 'error',
    brokerOrderId: null,
    brokerResponse: { error: err instanceof Error ? err.message : String(err) },
    filledPrice: null,
    executionLatencyMs: Date.now() - startedAt,
  }
}

/** One `ExecutionAdapter` per connected cTrader account (demo or live —
 * whichever the account itself is). Opens a short-lived session per call,
 * same lifecycle as the existing import flow in lib/brokers/ctrader. */
export function createCTraderAdapter(creds: CTraderCredentials, isLive: boolean): ExecutionAdapter {
  const host: CTraderHost = isLive ? 'live' : 'demo'

  return {
    id: 'ctrader',

    async placeOrder(req) {
      const start = Date.now()
      const session = await CTraderSession.connect(host)
      try {
        await session.authAccount(creds.ctidTraderAccountId, creds.accessToken)
        const symbols = await session.getSymbols(creds.ctidTraderAccountId)
        const symbol = symbols.find(s => String(s.symbolName ?? '').toUpperCase() === req.symbol.toUpperCase())
        if (!symbol) {
          return { status: 'rejected', brokerOrderId: null, brokerResponse: { error: `symbol "${req.symbol}" not found on this cTrader account` }, filledPrice: null, executionLatencyMs: Date.now() - start }
        }

        const execution = await session.newMarketOrder({
          ctidTraderAccountId: creds.ctidTraderAccountId,
          symbolId: Number(symbol.symbolId),
          tradeSide: req.side === 'long' ? TRADE_SIDE.BUY : TRADE_SIDE.SELL,
          volume: Math.round(req.qty * 100),
          stopLoss: req.sl ?? undefined,
          takeProfit: req.tp ?? undefined,
        })

        return {
          status: 'filled',
          brokerOrderId: String(execution?.order?.orderId ?? execution?.position?.positionId ?? ''),
          brokerResponse: execution,
          filledPrice: extractFillPrice(execution) ?? req.price,
          executionLatencyMs: Date.now() - start,
        }
      } catch (err) {
        return errorResult(start, err)
      } finally {
        session.close()
      }
    },

    async closePosition(req) {
      const start = Date.now()
      const positionId = extractPositionId(req.openOrder.brokerResponse)
      if (positionId == null) {
        return errorResult(start, new Error('No cTrader positionId found on the opening order — cannot close.'))
      }

      const session = await CTraderSession.connect(host)
      try {
        await session.authAccount(creds.ctidTraderAccountId, creds.accessToken)
        const execution = await session.closePosition(creds.ctidTraderAccountId, positionId, Math.round(req.qty * 100))
        return {
          status: 'filled',
          brokerOrderId: String(execution?.order?.orderId ?? positionId),
          brokerResponse: execution,
          filledPrice: extractFillPrice(execution) ?? req.price,
          executionLatencyMs: Date.now() - start,
        }
      } catch (err) {
        return errorResult(start, err)
      } finally {
        session.close()
      }
    },
  }
}
