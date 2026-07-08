import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { runSync, NoAccountSelectedError } from '@/lib/brokers/sync'
import { getFreshConnection, ReauthRequiredError } from '@/lib/brokers/ctrader/connection'

export const maxDuration = 60

/**
 * POST — synchronize closed trades. First run imports the full account
 * history; later runs only fetch deals newer than the stored cursor.
 * Returns { imported, done } — callers repeat the request while !done.
 */
export async function POST() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const conn = await getFreshConnection(supabase)
    if (!conn) return NextResponse.json({ error: 'not_connected' }, { status: 404 })
    const outcome = await runSync(supabase, user.id, conn)
    return NextResponse.json(outcome)
  } catch (e) {
    if (e instanceof ReauthRequiredError) return NextResponse.json({ error: 'reauth_required', message: e.message }, { status: 401 })
    if (e instanceof NoAccountSelectedError) return NextResponse.json({ error: 'no_account_selected', message: e.message }, { status: 400 })
    const msg = e instanceof Error ? e.message : 'Sync failed.'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
