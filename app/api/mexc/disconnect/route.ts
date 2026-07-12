import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

/**
 * POST — remove the MEXC connection (API key + sync state).
 * Imported trades stay in the journal; reconnecting later re-imports
 * nothing that is already present thanks to the unique broker_trade_id.
 */
export async function POST() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('broker_connections')
    .delete()
    .eq('broker', 'mexc')
  if (error) return NextResponse.json({ error: error.message }, { status: 502 })

  return NextResponse.json({ ok: true })
}
