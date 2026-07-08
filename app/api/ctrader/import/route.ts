import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { runSync, NoAccountSelectedError } from '@/lib/brokers/sync'
import { getFreshConnection, ReauthRequiredError } from '@/lib/brokers/ctrader/connection'

export const maxDuration = 60

/**
 * POST — full historical import: rewinds the sync cursor to the beginning of
 * the account's history and runs the first sync pass. The unique index on
 * (user_id, broker, broker_trade_id) guarantees re-scanned trades are never
 * duplicated. Call this ONCE; while the response says !done, continue with
 * POST /api/ctrader/sync (calling this route again would rewind again).
 */
export async function POST() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const conn = await getFreshConnection(supabase)
    if (!conn) return NextResponse.json({ error: 'not_connected' }, { status: 404 })

    if (Number(conn.last_deal_timestamp) !== 0) {
      const { error } = await supabase
        .from('broker_connections')
        .update({ last_deal_timestamp: 0, updated_at: new Date().toISOString() })
        .eq('id', conn.id)
      if (error) throw new Error(error.message)
      conn.last_deal_timestamp = 0
    }

    const outcome = await runSync(supabase, user.id, conn)
    return NextResponse.json(outcome)
  } catch (e) {
    if (e instanceof ReauthRequiredError) return NextResponse.json({ error: 'reauth_required', message: e.message }, { status: 401 })
    if (e instanceof NoAccountSelectedError) return NextResponse.json({ error: 'no_account_selected', message: e.message }, { status: 400 })
    const msg = e instanceof Error ? e.message : 'Import failed.'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
