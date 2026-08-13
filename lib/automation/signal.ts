import { createHash } from 'crypto'

/**
 * Generic signal contract — source-agnostic (see design doc §12). Today the
 * only SignalSource is the TradingView webhook; a future AI/algo source would
 * produce the same shape and reuse everything downstream unchanged.
 */
export type SignalSide = 'long' | 'short' | 'close'

export interface Signal {
  symbol: string
  side: SignalSide
  price: number
  sl: number | null
  tp: number | null
  timeframe: string | null
  time: string | null
}

const SIDES: SignalSide[] = ['long', 'short', 'close']

/** Validates the raw JSON body from a TradingView alert_message. Direct
 * evolution of tradingview-bot's `parseAlertPayload` — the `secret` field
 * itself is checked separately by the route (it's an auth concern, not a
 * shape concern), so it's not validated here. */
export function parseSignal(body: unknown): { ok: true; data: Signal } | { ok: false; errors: string[] } {
  const errors: string[] = []

  if (typeof body !== 'object' || body === null) {
    return { ok: false, errors: ['Body must be a JSON object'] }
  }
  const b = body as Record<string, unknown>

  if (typeof b.ticker !== 'string' || b.ticker.length === 0) {
    errors.push('ticker must be a non-empty string')
  }
  // TradingView's {{strategy.market_position}} placeholder emits "flat" for
  // a fully-closed position — accept it as an alias so one alert message can
  // cover entries and exits for both long and short without hand-editing
  // Pine code per direction.
  const normalizedSide = b.side === 'flat' ? 'close' : b.side
  if (typeof normalizedSide !== 'string' || !SIDES.includes(normalizedSide as SignalSide)) {
    errors.push(`side must be one of: ${SIDES.join(', ')} (or "flat", treated as "close")`)
  }
  if (typeof b.price !== 'number' || !Number.isFinite(b.price)) {
    errors.push('price must be a number')
  }
  if (b.sl !== undefined && b.sl !== null && typeof b.sl !== 'number') {
    errors.push('sl must be a number if present')
  }
  if (b.tp !== undefined && b.tp !== null && typeof b.tp !== 'number') {
    errors.push('tp must be a number if present')
  }
  if (b.timeframe !== undefined && b.timeframe !== null && typeof b.timeframe !== 'string') {
    errors.push('timeframe must be a string if present')
  }

  if (errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    data: {
      symbol: b.ticker as string,
      side: normalizedSide as SignalSide,
      price: b.price as number,
      sl: (b.sl as number) ?? null,
      tp: (b.tp as number) ?? null,
      timeframe: (b.timeframe as string) ?? null,
      time: typeof b.time === 'string' ? b.time : null,
    },
  }
}

/**
 * Dedupe key for TradingView's known double-fire-on-reconnect behaviour.
 * Prefer an explicit `id`/`alert_id` in the alert JSON (recommended in the
 * webhook setup instructions) — falls back to hashing the signal content
 * within a 5s bucket, which catches true duplicates without blocking two
 * genuinely distinct alerts that happen to share a price.
 */
export function computeIdempotencyKey(rawBody: Record<string, unknown>, signal: Signal, receivedAtMs: number): string {
  const explicit = rawBody.id ?? rawBody.alert_id
  if (typeof explicit === 'string' && explicit.length > 0) return explicit

  const DEDUPE_WINDOW_MS = 5000
  const bucket = Math.floor(receivedAtMs / DEDUPE_WINDOW_MS)
  const basis = `${signal.symbol}|${signal.side}|${signal.price}|${signal.sl}|${signal.tp}|${signal.timeframe}|${bucket}`
  return createHash('sha256').update(basis).digest('hex')
}
