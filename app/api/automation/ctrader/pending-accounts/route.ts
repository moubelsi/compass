import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getProvider } from '@/lib/brokers'

export const maxDuration = 60

/** Lists accounts for the pending (not-yet-saved) trading connection. */
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pendingRaw = req.cookies.get('automation_ctrader_pending')?.value
  if (!pendingRaw) return NextResponse.json({ error: 'no_pending_connection' }, { status: 404 })

  try {
    const pending = JSON.parse(Buffer.from(pendingRaw, 'base64').toString('utf8'))
    const accounts = await getProvider('ctrader').listAccounts!(pending.accessToken)
    return NextResponse.json({ accounts })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load accounts.'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
