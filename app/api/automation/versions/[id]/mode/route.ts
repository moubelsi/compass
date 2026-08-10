import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { writeAuditLog } from '@/lib/automation/broker-accounts'

const ALL_MODES = ['off', 'paper', 'live']

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const mode = body?.mode
  if (typeof mode !== 'string' || !ALL_MODES.includes(mode)) {
    return NextResponse.json({ error: `mode must be one of: ${ALL_MODES.join(', ')}` }, { status: 400 })
  }

  const { data: version } = await supabase
    .from('automation_strategy_versions')
    .select('id, version_label, mode, broker_account_id, automation_broker_accounts(broker, label, is_live)')
    .eq('id', id)
    .single()
  if (!version) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  if (mode === 'live' && !version.broker_account_id) {
    return NextResponse.json({ error: 'Connect and select a broker account in Settings before switching to live.' }, { status: 400 })
  }

  const { error } = await supabase.from('automation_strategy_versions').update({ mode }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (mode === 'live' || version.mode === 'live') {
    const account = version.automation_broker_accounts as unknown as { broker: string; label: string; is_live: boolean } | null
    await writeAuditLog(supabase, user.id, mode === 'live' ? 'mode_changed_to_live' : 'mode_changed_from_live', {
      version_id: id,
      version_label: version.version_label,
      broker: account?.broker,
      broker_label: account?.label,
      is_live_account: account?.is_live,
    })
  }

  return NextResponse.json({ ok: true, mode })
}
