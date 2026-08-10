import { createHmac } from 'crypto'

/**
 * Minimal OKX v5 REST client — HMAC-signed requests, no OAuth (API key +
 * secret + passphrase). Demo vs. live is which key is connected, sent via
 * the `x-simulated-trading` header (OKX docs: 1 for demo, 0/omitted for
 * real). Spot only for now — see lib/automation/execution/okx.ts for why.
 */
const BASE_URL = 'https://www.okx.com'

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

export async function verifyCredentials(creds: OkxCredentials, isDemo: boolean): Promise<boolean> {
  const res = await request(creds, isDemo, 'GET', '/api/v5/account/config')
  return res.ok
}
