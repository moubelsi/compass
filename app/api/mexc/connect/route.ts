import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getProvider } from '@/lib/brokers'
import { getFreshConnection } from '@/lib/brokers/ctrader/connection'

export const maxDuration = 30

/** GET — connection status for the Settings card. */
export async function GET() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await getFreshConnection(supabase, 'mexc').catch(() => null)
  if (!conn) return NextResponse.json({ error: 'not_connected' }, { status: 404 })
  return NextResponse.json({
    account: conn.account_info?.accounts?.[0] ?? null,
    last_synced_at: conn.last_synced_at,
  })
}

/**
 * POST { apiKey, apiSecret } — validate the credentials against MEXC and
 * store the connection. A read-only futures key is enough; the secret is
 * stored server-side behind RLS, exactly like the cTrader tokens.
 */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : ''
  const apiSecret = typeof body?.apiSecret === 'string' ? body.apiSecret.trim() : ''
  if (!apiKey || !apiSecret) return NextResponse.json({ error: 'API key and secret are required.' }, { status: 400 })

  try {
    const account = await getProvider('mexc').verifyCredentials!(apiKey, apiSecret)
    const { error } = await supabase
      .from('broker_connections')
      .upsert({
        user_id: user.id,
        broker: 'mexc',
        access_token: apiKey,
        refresh_token: apiSecret,
        expires_at: '2099-01-01T00:00:00Z', // API keys don't expire on a schedule
        broker_account_id: account.id,
        account_info: { accounts: [account], fetched_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,broker' })
    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true, account })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not connect to MEXC.'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
