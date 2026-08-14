import { createHmac } from 'crypto'

/**
 * Minimal OKX v5 REST client — HMAC-signed requests, no OAuth (API key +
 * secret + passphrase). Demo vs. live is which key is connected, sent via
 * the `x-simulated-trading` header (OKX docs: 1 for demo, 0/omitted for
 * real). Spot only for now — see lib/automation/execution/okx.ts for why.
 *
 * OKX segregates accounts by region onto different API domains — a key
 * created under the EEA entity (which Dutch/EU accounts are) doesn't exist
 * on www.okx.com and fails with "API key doesn't exist" no matter how
 * correct it is. Hardcoded to eea.okx.com since that's this app's only
 * user; revisit with a per-account setting if that ever changes.
 */
const BASE_URL = 'https://eea.okx.com'

export interface OkxCredentials {
  apiKey: string
  apiSecret: string
  passphrase: string
}

function sign(secret: string, timestamp: string, method: string, requestPath: string, body: string): string {
  return createHmac('sha256', secret).update(timestamp + method + requestPath + body).digest('base64')
}

async function request(creds: OkxCredentials, isDemo: boolean, method: 'GET' | 'POST', path: string, body?: Record<string, unknown>) {
  const timestamp = new Date().toISOString()
  const bodyStr = body ? JSON.stringify(body) : ''
  const headers: Record<string, string> = {
    'OK-ACCESS-KEY': creds.apiKey,
    'OK-ACCESS-SIGN': sign(creds.apiSecret, timestamp, method, path, bodyStr),
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': creds.passphrase,
    'Content-Type': 'application/json',
  }
  if (isDemo) headers['x-simulated-trading'] = '1'

  const res = await fetch(`${BASE_URL}${path}`, { method, headers, body: method === 'POST' ? bodyStr : undefined })
  const data = await res.json().catch(() => null)
  return { ok: res.ok && data?.code === '0', status: res.status, data }
}

export interface OkxOrderResult {
  ok: boolean
  ordId: string | null
  avgPx: number | null
  raw: unknown
}

/**
 * Places a spot market order. `tgtCcy: 'base_ccy'` on buys keeps `sz` in
 * base-currency units (BTC) on both sides — OKX otherwise defaults buy
 * market orders' `sz` to quote currency (USDT), which would silently mean
 * something different from our qty.
 *
 * Market-order fills aren't always reported instantly, so this does one
 * short poll for `avgPx`; if that comes back empty the caller falls back to
 * the signal price — good enough for now, worth tightening (WS fills feed)
 * once this is proven on demo.
 */
export async function placeMarketOrder(creds: OkxCredentials, isDemo: boolean, args: {
  instId: string
  side: 'buy' | 'sell'
  sz: string
}): Promise<OkxOrderResult> {
  const res = await request(creds, isDemo, 'POST', '/api/v5/trade/order', {
    instId: args.instId,
    tdMode: 'cash',
    side: args.side,
    ordType: 'market',
    sz: args.sz,
    ...(args.side === 'buy' ? { tgtCcy: 'base_ccy' } : {}),
  })
  const order = res.data?.data?.[0]
  const ordId = order?.ordId ?? null
  if (!res.ok || !ordId || order?.sCode !== '0') {
    return { ok: false, ordId, avgPx: null, raw: res.data }
  }

  await new Promise(r => setTimeout(r, 500))
  const path = `/api/v5/trade/order?instId=${args.instId}&ordId=${ordId}`
  const detail = await request(creds, isDemo, 'GET', path)
  const avgPx = Number(detail.data?.data?.[0]?.avgPx) || null
  return { ok: true, ordId, avgPx, raw: { placed: res.data, detail: detail.data } }
}

/**
 * Places a spot-margin (cross) market order with optional attached SL/TP
 * (OKX's native `attachAlgoOrds`, executed exchange-side on trigger).
 * `side: 'sell'` without holding the base currency opens a short by
 * borrowing it — that's the whole point of trading this instId with
 * tdMode `cross` instead of `cash`. No separate leverage-setting call: unlike
 * futures/swap, OKX spot margin doesn't take an explicit leverage parameter
 * — the effective leverage falls out of position size vs. account equity,
 * which our own risk engine already controls via qty.
 *
 * Confirmed 2026-08-12 against this account: BTC-EUR only supports `cross`
 * margin, not `isolated` (OKX doesn't list an isolated-margin variant for
 * this pair at all — a product gap, not a config issue).
 */
export async function placeMarginOrder(creds: OkxCredentials, isDemo: boolean, args: {
  instId: string
  side: 'buy' | 'sell'
  sz: string
  sl: number | null
  tp: number | null
}): Promise<OkxOrderResult> {
  const attachAlgoOrds: Record<string, string>[] = []
  if (args.sl != null || args.tp != null) {
    const algo: Record<string, string> = {}
    if (args.sl != null) { algo.slTriggerPx = String(args.sl); algo.slOrdPx = '-1'; algo.slTriggerPxType = 'last' }
    if (args.tp != null) { algo.tpTriggerPx = String(args.tp); algo.tpOrdPx = '-1'; algo.tpTriggerPxType = 'last' }
    attachAlgoOrds.push(algo)
  }

  const res = await request(creds, isDemo, 'POST', '/api/v5/trade/order', {
    instId: args.instId,
    tdMode: 'cross',
    side: args.side,
    ordType: 'market',
    sz: args.sz,
    ...(args.side === 'buy' ? { tgtCcy: 'base_ccy' } : {}),
    ...(attachAlgoOrds.length > 0 ? { attachAlgoOrds } : {}),
  })
  const order = res.data?.data?.[0]
  const ordId = order?.ordId ?? null
  if (!res.ok || !ordId || order?.sCode !== '0') {
    return { ok: false, ordId, avgPx: null, raw: res.data }
  }

  await new Promise(r => setTimeout(r, 600))
  const detail = await request(creds, isDemo, 'GET', `/api/v5/trade/order?instId=${args.instId}&ordId=${ordId}`)
  const avgPx = Number(detail.data?.data?.[0]?.avgPx) || null
  return { ok: true, ordId, avgPx, raw: { placed: res.data, detail: detail.data, openSide: args.side } }
}

/** Live last-traded price — public endpoint, no signing needed. Used as the
 * current-price proxy for unrealized P&L on open positions. */
export async function getTickerPrice(instId: string): Promise<number | null> {
  const res = await fetch(`${BASE_URL}/api/v5/market/ticker?instId=${instId}`)
  const data = await res.json().catch(() => null) as { data?: Array<{ last?: string }> } | null
  const last = data?.data?.[0]?.last
  return last ? Number(last) : null
}

export interface VerifyResult {
  ok: boolean
  reason?: string
}

export async function verifyCredentials(creds: OkxCredentials, isDemo: boolean): Promise<VerifyResult> {
  const res = await request(creds, isDemo, 'GET', '/api/v5/account/config')
  if (res.ok) return { ok: true }
  const data = res.data as { msg?: string; code?: string; data?: Array<{ sMsg?: string }> } | null
  const reason = data?.msg || data?.data?.[0]?.sMsg || `HTTP ${res.status}${data?.code ? ` (OKX code ${data.code})` : ''}`
  return { ok: false, reason }
}
