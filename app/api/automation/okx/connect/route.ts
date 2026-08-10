import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { verifyCredentials, type OkxCredentials } from '@/lib/brokers/okx/client'
import { encryptCredentials } from '@/lib/automation/crypto'
import { writeAuditLog } from '@/lib/automation/broker-accounts'

export const maxDuration = 30

/** POST { apiKey, apiSecret, passphrase, isLive, label } — OKX has no
 * OAuth, so this verifies the key against OKX before saving anything. */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const { apiKey, apiSecret, passphrase, isLive, label } = body ?? {}
  if (!apiKey || !apiSecret || !passphrase) {
    return NextResponse.json({ error: 'API key, secret and passphrase are all required.' }, { status: 400 })
  }

  const creds: OkxCredentials = { apiKey, apiSecret, passphrase }
  const ok = await verifyCredentials(creds, !isLive)
  if (!ok) {
    return NextResponse.json({ error: 'OKX rejected these credentials — double-check the key, secret, passphrase and whether this is a Demo Trading key.' }, { status: 400 })
  }

  const { data: saved, error } = await supabase
    .from('automation_broker_accounts')
    .insert({
      user_id: user.id,
      broker: 'okx',
      label: label?.trim() || (isLive ? 'OKX (live)' : 'OKX (demo)'),
      is_live: !!isLive,
      credentials: encryptCredentials(creds as unknown as Record<string, unknown>),
      status: 'connected',
    })
    .select('id, broker, label, is_live, status, created_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog(supabase, user.id, 'broker_connected', { broker: 'okx', account_id: saved.id, is_live: !!isLive })
  return NextResponse.json({ ok: true, account: saved })
}
