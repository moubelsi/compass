import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { writeAuditLog } from '@/lib/automation/broker-accounts'

/** Disconnects a broker account — works for both cTrader and OKX (RLS scopes
 * it to the owner either way). Any strategy version pointing at it falls
 * back to broker_account_id=null (on delete set null), effectively pausing
 * live execution for that version until reconnected. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: account } = await supabase.from('automation_broker_accounts').select('broker, label').eq('id', id).single()
  const { error } = await supabase.from('automation_broker_accounts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (account) await writeAuditLog(supabase, user.id, 'broker_disconnected', { broker: account.broker, label: account.label })
  return NextResponse.json({ ok: true })
}
