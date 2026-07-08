import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getProvider } from '@/lib/brokers'
import { getFreshConnection, ReauthRequiredError } from '@/lib/brokers/ctrader/connection'

export const maxDuration = 60

const CACHE_TTL_MS = 60 * 60 * 1000

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

    const accounts = await getProvider('ctrader').listAccounts(conn.access_token)
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
