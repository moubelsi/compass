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

/**
 * A just-submitted market order's own ProtoOAExecutionEvent can report
 * position.price = 0 (order accepted, fill not caught up with the response
 * yet — confirmed on a real Pepperstone demo fill). Poll the open-positions
 * list briefly until the real price shows up rather than publish a trade
 * with a 0 entry price (silently wrecks the P&L math downstream).
 */
async function resolveFillPrice(
  session: CTraderSession,
  ctidTraderAccountId: number,
  positionId: number | null,
  immediate: number | null,
): Promise<number | null> {
  if (immediate) return immediate
  if (positionId == null) return null
  for (let i = 0; i < 3; i++) {
    await new Promise(r => setTimeout(r, 600))
    const positions = await session.getOpenPositions(ctidTraderAccountId)
    const match = positions.find(p => Number(p.positionId) === positionId)
    const price = match ? Number(match.price) : 0
    if (price > 0) return price
  }
  return null
}

/**
 * cTrader rejects any volume that isn't an exact multiple of the symbol's
 * volume step, not just "above the minimum" — confirmed against a real
 * Pepperstone demo account ("Order volume must be multiple of volume step =
 * 1000.00"). The light symbol list (getSymbols) doesn't expose the true
 * per-symbol step, so this rounds to the common FX/CFD micro-lot step
 * (1000 units) as a working default; a symbol with a genuinely different
 * step would need the full ProtoOASymbol spec to get exactly right.
 */
const VOLUME_STEP_CENTS = 1000 * 100 // 1000 units, in cTrader's cents format

function roundToVolumeStep(qty: number): number {
  const raw = Math.round(qty * 100)
  return Math.max(VOLUME_STEP_CENTS, Math.round(raw / VOLUME_STEP_CENTS) * VOLUME_STEP_CENTS)
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
          volume: roundToVolumeStep(req.qty),
          stopLoss: req.sl ?? undefined,
          takeProfit: req.tp ?? undefined,
        })

        const positionId = extractPositionId(execution)
        const filledPrice = await resolveFillPrice(session, creds.ctidTraderAccountId, positionId, extractFillPrice(execution))

        return {
          status: 'filled',
          brokerOrderId: String(execution?.order?.orderId ?? positionId ?? ''),
          brokerResponse: execution,
          filledPrice: filledPrice ?? req.price,
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
        const execution = await session.closePosition(creds.ctidTraderAccountId, positionId, roundToVolumeStep(req.qty))
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
