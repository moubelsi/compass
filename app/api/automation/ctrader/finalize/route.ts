import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getProvider } from '@/lib/brokers'
import { encryptCredentials } from '@/lib/automation/crypto'
import { writeAuditLog, type CTraderStoredCreds } from '@/lib/automation/broker-accounts'

export const maxDuration = 60

/** Saves the chosen account from the pending cookie as a new, encrypted
 * automation_broker_accounts row, then clears the cookie. */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pendingRaw = req.cookies.get('automation_ctrader_pending')?.value
  if (!pendingRaw) return NextResponse.json({ error: 'no_pending_connection' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const accountId = typeof body?.accountId === 'string' ? body.accountId : null
  if (!accountId) return NextResponse.json({ error: 'accountId is required.' }, { status: 400 })

  try {
    const pending = JSON.parse(Buffer.from(pendingRaw, 'base64').toString('utf8')) as { accessToken: string; refreshToken: string; expiresAt: string }
    const accounts = await getProvider('ctrader').listAccounts!(pending.accessToken)
    const account = accounts.find(a => a.id === accountId)
    if (!account) return NextResponse.json({ error: 'Unknown account. Reconnect and try again.' }, { status: 400 })

    const creds: CTraderStoredCreds = {
      accessToken: pending.accessToken,
      refreshToken: pending.refreshToken,
      expiresAt: pending.expiresAt,
      ctidTraderAccountId: Number(account.id),
    }

    const { data: saved, error } = await supabase
      .from('automation_broker_accounts')
      .insert({
        user_id: user.id,
        broker: 'ctrader',
        label: `${account.brokerName} — ${account.accountNumber}`,
        is_live: account.isLive,
        credentials: encryptCredentials(creds as unknown as Record<string, unknown>),
        status: 'connected',
      })
      .select('id, broker, label, is_live, status, created_at')
      .single()
    if (error) throw new Error(error.message)

    await writeAuditLog(supabase, user.id, 'broker_connected', { broker: 'ctrader', account_id: saved.id, is_live: account.isLive })

    const res = NextResponse.json({ ok: true, account: saved })
    res.cookies.delete('automation_ctrader_pending')
    return res
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to save the connection.'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
