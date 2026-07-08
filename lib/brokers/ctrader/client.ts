/**
 * Minimal JSON-over-WebSocket client for the cTrader Open API (Spotware).
 * Sessions are short-lived: open → application auth → a few requests → close.
 * Live and demo accounts live on separate hosts; a session is bound to one.
 */

const HOSTS = {
  live: 'wss://live.ctraderapi.com:5036',
  demo: 'wss://demo.ctraderapi.com:5036',
} as const

export type CTraderHost = keyof typeof HOSTS

/** ProtoOAPayloadType values — identical for the JSON and protobuf transports */
export const PT = {
  ERROR: 50,
  HEARTBEAT: 51,
  APPLICATION_AUTH_REQ: 2100,
  ACCOUNT_AUTH_REQ: 2102,
  ASSET_LIST_REQ: 2112,
  SYMBOLS_LIST_REQ: 2114,
  TRADER_REQ: 2121,
  RECONCILE_REQ: 2124,
  DEAL_LIST_REQ: 2133,
  OA_ERROR_RES: 2142,
  GET_ACCOUNTS_BY_TOKEN_REQ: 2149,
  DEAL_LIST_BY_POSITION_ID_REQ: 2178,
} as const

interface Envelope {
  clientMsgId?: string
  payloadType: number
  payload: Record<string, any>
}

export interface CTraderApiError extends Error {
  errorCode?: string
}

function apiError(payload: Record<string, any>, fallback: string): CTraderApiError {
  const err = new Error(payload?.description || payload?.errorCode || fallback) as CTraderApiError
  err.errorCode = payload?.errorCode
  return err
}

export class CTraderSession {
  private pending = new Map<string, { resolve: (p: Record<string, any>) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>()
  private heartbeat: ReturnType<typeof setInterval> | null = null
  private nextId = 1

  private constructor(private ws: WebSocket, readonly host: CTraderHost) {
    ws.addEventListener('message', (ev) => this.onMessage(String(ev.data)))
    ws.addEventListener('close', () => this.failAll(new Error('cTrader connection closed unexpectedly.')))
    ws.addEventListener('error', () => this.failAll(new Error('cTrader connection error.')))
    // The server drops silent clients; ping every 10s in case a sync runs long
    this.heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ payloadType: PT.HEARTBEAT }))
    }, 10_000)
  }

  /** Open a socket and authenticate the application (client id + secret). */
  static async connect(host: CTraderHost): Promise<CTraderSession> {
    const clientId = process.env.CTRADER_CLIENT_ID
    const clientSecret = process.env.CTRADER_CLIENT_SECRET
    if (!clientId || !clientSecret) throw new Error('cTrader is not configured. Set CTRADER_CLIENT_ID and CTRADER_CLIENT_SECRET.')

    const ws = new WebSocket(HOSTS[host])
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Timed out connecting to cTrader.')), 15_000)
      ws.addEventListener('open', () => { clearTimeout(t); resolve() }, { once: true })
      ws.addEventListener('error', () => { clearTimeout(t); reject(new Error('Could not reach the cTrader API.')) }, { once: true })
    })

    const session = new CTraderSession(ws, host)
    await session.request(PT.APPLICATION_AUTH_REQ, { clientId, clientSecret })
    return session
  }

  private onMessage(raw: string) {
    let msg: Envelope
    try { msg = JSON.parse(raw) } catch { return }
    if (msg.payloadType === PT.HEARTBEAT) return

    const entry = msg.clientMsgId ? this.pending.get(msg.clientMsgId) : undefined
    if (!entry) return
    this.pending.delete(msg.clientMsgId!)
    clearTimeout(entry.timer)

    if (msg.payloadType === PT.ERROR || msg.payloadType === PT.OA_ERROR_RES) {
      entry.reject(apiError(msg.payload, 'cTrader API request failed.'))
    } else {
      entry.resolve(msg.payload ?? {})
    }
  }

  private failAll(err: Error) {
    for (const [, entry] of this.pending) { clearTimeout(entry.timer); entry.reject(err) }
    this.pending.clear()
  }

  request(payloadType: number, payload: Record<string, any>, timeoutMs = 20_000): Promise<Record<string, any>> {
    if (this.ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error('cTrader connection is not open.'))
    const clientMsgId = String(this.nextId++)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(clientMsgId)
        reject(new Error('cTrader API request timed out.'))
      }, timeoutMs)
      this.pending.set(clientMsgId, { resolve, reject, timer })
      this.ws.send(JSON.stringify({ clientMsgId, payloadType, payload }))
    })
  }

  close() {
    if (this.heartbeat) clearInterval(this.heartbeat)
    this.failAll(new Error('Session closed.'))
    try { this.ws.close() } catch { /* already closed */ }
  }

  // ── Typed helpers ──────────────────────────────────────────────────────────

  /** All ctid trading accounts the access token grants access to (live + demo). */
  async getAccountsByToken(accessToken: string): Promise<Array<Record<string, any>>> {
    const res = await this.request(PT.GET_ACCOUNTS_BY_TOKEN_REQ, { accessToken })
    return res.ctidTraderAccount ?? []
  }

  /** Authorize one trading account on this session — required before account-scoped requests. */
  async authAccount(ctidTraderAccountId: number, accessToken: string): Promise<void> {
    await this.request(PT.ACCOUNT_AUTH_REQ, { ctidTraderAccountId, accessToken })
  }

  /** Account details: balance (scaled by moneyDigits), broker name, deposit asset. */
  async getTrader(ctidTraderAccountId: number): Promise<Record<string, any>> {
    const res = await this.request(PT.TRADER_REQ, { ctidTraderAccountId })
    return res.trader ?? {}
  }

  /** Assets for the account — used to resolve the deposit currency name. */
  async getAssets(ctidTraderAccountId: number): Promise<Array<Record<string, any>>> {
    const res = await this.request(PT.ASSET_LIST_REQ, { ctidTraderAccountId })
    return res.asset ?? []
  }

  /** Symbol id → name mapping for the account. */
  async getSymbols(ctidTraderAccountId: number): Promise<Array<Record<string, any>>> {
    const res = await this.request(PT.SYMBOLS_LIST_REQ, { ctidTraderAccountId, includeArchivedSymbols: true })
    return res.symbol ?? []
  }

  /** Executed deals in [fromTimestamp, toTimestamp] (ms since epoch, max 1 week apart). */
  async getDeals(ctidTraderAccountId: number, fromTimestamp: number, toTimestamp: number, maxRows = 500): Promise<Array<Record<string, any>>> {
    const res = await this.request(PT.DEAL_LIST_REQ, { ctidTraderAccountId, fromTimestamp, toTimestamp, maxRows }, 30_000)
    return res.deal ?? []
  }

  /** Every deal belonging to one position — used when a position's legs span the scan window. */
  async getDealsByPosition(ctidTraderAccountId: number, positionId: number): Promise<Array<Record<string, any>>> {
    const res = await this.request(PT.DEAL_LIST_BY_POSITION_ID_REQ, { ctidTraderAccountId, positionId }, 30_000)
    return res.deal ?? []
  }

  /** Currently open positions — their ids are excluded from import until fully closed. */
  async getOpenPositionIds(ctidTraderAccountId: number): Promise<Set<number>> {
    const res = await this.request(PT.RECONCILE_REQ, { ctidTraderAccountId }, 30_000)
    return new Set((res.position ?? []).map((p: Record<string, any>) => Number(p.positionId)))
  }
}
