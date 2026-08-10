import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { generateWebhookSecret } from '@/lib/automation/tokens'

/** Rotates the shared secret only — the url_token (and therefore the
 * TradingView alert's webhook URL) stays the same. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('automation_webhooks')
    .update({ webhook_secret: generateWebhookSecret() })
    .eq('strategy_version_id', id)
    .select('webhook_secret')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Webhook not found for this version.' }, { status: 404 })
  return NextResponse.json({ ok: true, webhook_secret: data.webhook_secret })
}
