import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { CTraderSession, type CTraderHost } from '@/lib/brokers/ctrader/client'
import { getFreshConnection, ReauthRequiredError } from '@/lib/brokers/ctrader/connection'
import type { BrokerAccount } from '@/lib/brokers/types'

export const maxDuration = 60

const CACHE_TTL_MS = 60 * 60 * 1000

/**
 * Fetches account details from both cTrader hosts. Detail lookups
 * (balance/currency) are best-effort: an account that fails detail
 * resolution is still listed so the user can select it.
 */
async function fetchAccounts(accessToken: string): Promise<BrokerAccount[]> {
  const live = await CTraderSession.connect('live')
  try {
    const raw = await live.getAccountsByToken(accessToken)
    if (raw.length === 0) return []

    const byHost: Record<CTraderHost, Array<Record<string, any>>> = { live: [], demo: [] }
    raw.forEach(a => byHost[a.isLive ? 'live' : 'demo'].push(a))

    const accounts: BrokerAccount[] = []
    for (const host of ['live', 'demo'] as CTraderHost[]) {
      if (byHost[host].length === 0) continue
      const session = host === 'live' ? live : await CTraderSession.connect('demo')
      try {
        for (const a of byHost[host]) {
          const id = Number(a.ctidTraderAccountId)
          const base: BrokerAccount = {
            id: String(id),
            brokerName: a.brokerTitleShort || 'cTrader',
            accountNumber: String(a.traderLogin ?? id),
            isLive: !!a.isLive,
            currency: '',
            balance: 0,
          }
          try {
            await session.authAccount(id, accessToken)
            const [trader, assets] = [await session.getTrader(id), await session.getAssets(id)]
            const moneyDigits = Number(trader.moneyDigits ?? 2)
            base.balance = Number(trader.balance ?? 0) / 10 ** moneyDigits
            base.brokerName = trader.brokerName || base.brokerName
            const depositAsset = assets.find(x => Number(x.assetId) === Number(trader.depositAssetId))
            base.currency = depositAsset?.name || ''
          } catch {
            // keep the basic entry — selection must not depend on detail calls
          }
          accounts.push(base)
        }
      } finally {
        if (session !== live) session.close()
      }
    }
    return accounts
  } finally {
    live.close()
  }
}

/** GET — list trading accounts (cached 1h; ?refresh=1 forces a refetch). */
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const conn = await getFreshConnection(supabase)
    if (!conn) return NextResponse.json({ error: 'not_connected' }, { status: 404 })

    const cached = conn.account_info
    const fresh = cached?.fetched_at && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_TTL_MS
    if (fresh && cached?.accounts && !req.nextUrl.searchParams.get('refresh')) {
      return NextResponse.json({ accounts: cached.accounts, selected: conn.broker_account_id })
    }

    const accounts = await fetchAccounts(conn.access_token)
    await supabase
      .from('broker_connections')
      .update({ account_info: { accounts, fetched_at: new Date().toISOString() }, updated_at: new Date().toISOString() })
      .eq('id', conn.id)

    return NextResponse.json({ accounts, selected: conn.broker_account_id })
  } catch (e) {
    if (e instanceof ReauthRequiredError) return NextResponse.json({ error: 'reauth_required', message: e.message }, { status: 401 })
    const msg = e instanceof Error ? e.message : 'Failed to load accounts.'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

/** POST { accountId } — persist the chosen trading account. */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const accountId = typeof body?.accountId === 'string' ? body.accountId : null
  if (!accountId) return NextResponse.json({ error: 'accountId is required.' }, { status: 400 })

  try {
    const conn = await getFreshConnection(supabase)
    if (!conn) return NextResponse.json({ error: 'not_connected' }, { status: 404 })

    const known = conn.account_info?.accounts?.some(a => a.id === accountId)
    if (!known) return NextResponse.json({ error: 'Unknown account. Refresh the account list first.' }, { status: 400 })

    // Switching accounts restarts the import from the beginning of that account's history
    const changed = conn.broker_account_id !== accountId
    const { error } = await supabase
      .from('broker_connections')
      .update({
        broker_account_id: accountId,
        ...(changed ? { last_deal_timestamp: 0, last_synced_at: null } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conn.id)
    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof ReauthRequiredError) return NextResponse.json({ error: 'reauth_required', message: e.message }, { status: 401 })
    const msg = e instanceof Error ? e.message : 'Failed to save account.'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
