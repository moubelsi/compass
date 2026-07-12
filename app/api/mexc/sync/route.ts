import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { runSync, NoAccountSelectedError } from '@/lib/brokers/sync'
import { getFreshConnection } from '@/lib/brokers/ctrader/connection'

export const maxDuration = 60

/**
 * POST — synchronize closed MEXC futures positions. First run imports the
 * full available history; later runs only fetch positions closed after the
 * stored cursor. Returns { imported, done } — callers repeat while !done.
 */
export async function POST() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const conn = await getFreshConnection(supabase, 'mexc')
    if (!conn) return NextResponse.json({ error: 'not_connected' }, { status: 404 })
    const outcome = await runSync(supabase, user.id, conn)
    return NextResponse.json(outcome)
  } catch (e) {
    if (e instanceof NoAccountSelectedError) return NextResponse.json({ error: 'no_account_selected', message: e.message }, { status: 400 })
    const raw = e instanceof Error ? e.message : 'Sync failed.'
    return NextResponse.json({ error: raw }, { status: 502 })
  }
}
